import { relations, sql } from 'drizzle-orm';
import {
	bigint,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

export * from './auth.schema';

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
};

/* -------------------------------------------------------------------------- */
/*                                  Servers                                   */
/* -------------------------------------------------------------------------- */

/** A community ("guild" in Discord terms). Each one is shown as a tab in the UI. */
export const server = pgTable('server', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	iconUrl: text('icon_url'),
	ownerId: text('owner_id')
		.notNull()
		.references(() => user.id, { onDelete: 'restrict' }),
	...timestamps
});

export const member = pgTable(
	'member',
	{
		serverId: uuid('server_id')
			.notNull()
			.references(() => server.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		nickname: text('nickname'),
		joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [primaryKey({ columns: [t.serverId, t.userId] }), index('member_user_idx').on(t.userId)]
);

/**
 * Permissions are stored as a bit mask, see `#lib/permissions`.
 * The `@everyone` role of a server has `position = 0`.
 */
export const role = pgTable(
	'role',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		serverId: uuid('server_id')
			.notNull()
			.references(() => server.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		color: text('color'),
		position: integer('position').notNull().default(0),
		permissions: bigint('permissions', { mode: 'bigint' })
			.notNull()
			.default(sql`0`),
		...timestamps
	},
	(t) => [index('role_server_idx').on(t.serverId)]
);

export const memberRole = pgTable(
	'member_role',
	{
		serverId: uuid('server_id').notNull(),
		userId: text('user_id').notNull(),
		roleId: uuid('role_id')
			.notNull()
			.references(() => role.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.serverId, t.userId, t.roleId] })]
);

export const invite = pgTable('invite', {
	code: text('code').primaryKey(),
	serverId: uuid('server_id')
		.notNull()
		.references(() => server.id, { onDelete: 'cascade' }),
	createdById: text('created_by_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	maxUses: integer('max_uses'),
	uses: integer('uses').notNull().default(0),
	expiresAt: timestamp('expires_at', { withTimezone: true }),
	...timestamps
});

/* -------------------------------------------------------------------------- */
/*                                  Channels                                  */
/* -------------------------------------------------------------------------- */

export const channelType = pgEnum('channel_type', ['category', 'text', 'voice']);

export const channel = pgTable(
	'channel',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		serverId: uuid('server_id')
			.notNull()
			.references(() => server.id, { onDelete: 'cascade' }),
		/** Category this channel belongs to, if any. */
		parentId: uuid('parent_id'),
		type: channelType('type').notNull(),
		name: text('name').notNull(),
		topic: text('topic'),
		position: integer('position').notNull().default(0),
		...timestamps
	},
	(t) => [index('channel_server_idx').on(t.serverId)]
);

/** Per-channel permission overwrites for a role or a single member. */
export const channelOverwrite = pgTable(
	'channel_overwrite',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		channelId: uuid('channel_id')
			.notNull()
			.references(() => channel.id, { onDelete: 'cascade' }),
		roleId: uuid('role_id').references(() => role.id, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		allow: bigint('allow', { mode: 'bigint' })
			.notNull()
			.default(sql`0`),
		deny: bigint('deny', { mode: 'bigint' })
			.notNull()
			.default(sql`0`)
	},
	(t) => [index('channel_overwrite_channel_idx').on(t.channelId)]
);

/* -------------------------------------------------------------------------- */
/*                         Friends and direct messages                        */
/* -------------------------------------------------------------------------- */

export const friendshipStatus = pgEnum('friendship_status', ['pending', 'accepted', 'blocked']);

/** One row per pair; `requesterId` sent the request to `addresseeId`. */
export const friendship = pgTable(
	'friendship',
	{
		requesterId: text('requester_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		addresseeId: text('addressee_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		status: friendshipStatus('status').notNull().default('pending'),
		...timestamps
	},
	(t) => [
		primaryKey({ columns: [t.requesterId, t.addresseeId] }),
		index('friendship_addressee_idx').on(t.addresseeId)
	]
);

export const conversationType = pgEnum('conversation_type', ['direct', 'group']);

/** A 1:1 chat with a friend, or a group chat. Kept separate from server channels. */
export const conversation = pgTable('conversation', {
	id: uuid('id').primaryKey().defaultRandom(),
	type: conversationType('type').notNull(),
	/** Only used for group conversations. */
	name: text('name'),
	...timestamps
});

export const conversationMember = pgTable(
	'conversation_member',
	{
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(t) => [
		primaryKey({ columns: [t.conversationId, t.userId] }),
		index('conversation_member_user_idx').on(t.userId)
	]
);

/* -------------------------------------------------------------------------- */
/*                                  Messages                                  */
/* -------------------------------------------------------------------------- */

/** A message lives either in a server channel or in a conversation, never both. */
export const message = pgTable(
	'message',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		channelId: uuid('channel_id').references(() => channel.id, { onDelete: 'cascade' }),
		conversationId: uuid('conversation_id').references(() => conversation.id, {
			onDelete: 'cascade'
		}),
		authorId: text('author_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		content: text('content').notNull(),
		replyToId: uuid('reply_to_id'),
		editedAt: timestamp('edited_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [
		index('message_channel_created_idx').on(t.channelId, t.createdAt),
		index('message_conversation_created_idx').on(t.conversationId, t.createdAt)
	]
);

export const attachment = pgTable('attachment', {
	id: uuid('id').primaryKey().defaultRandom(),
	messageId: uuid('message_id')
		.notNull()
		.references(() => message.id, { onDelete: 'cascade' }),
	url: text('url').notNull(),
	fileName: text('file_name').notNull(),
	mimeType: text('mime_type').notNull(),
	size: integer('size').notNull()
});

export const reaction = pgTable(
	'reaction',
	{
		messageId: uuid('message_id')
			.notNull()
			.references(() => message.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		emoji: text('emoji').notNull()
	},
	(t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })]
);

/** Last message a user has read, per channel or conversation. Drives unread dots on tabs. */
export const readState = pgTable(
	'read_state',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		channelId: uuid('channel_id').references(() => channel.id, { onDelete: 'cascade' }),
		conversationId: uuid('conversation_id').references(() => conversation.id, {
			onDelete: 'cascade'
		}),
		lastReadMessageId: uuid('last_read_message_id'),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [
		uniqueIndex('read_state_user_channel_idx').on(t.userId, t.channelId),
		uniqueIndex('read_state_user_conversation_idx').on(t.userId, t.conversationId)
	]
);

/* -------------------------------------------------------------------------- */
/*                                 Relations                                  */
/* -------------------------------------------------------------------------- */

export const serverRelations = relations(server, ({ many }) => ({
	members: many(member),
	channels: many(channel),
	roles: many(role)
}));

export const memberRelations = relations(member, ({ one }) => ({
	server: one(server, { fields: [member.serverId], references: [server.id] }),
	user: one(user, { fields: [member.userId], references: [user.id] })
}));

export const channelRelations = relations(channel, ({ one, many }) => ({
	server: one(server, { fields: [channel.serverId], references: [server.id] }),
	messages: many(message)
}));

export const messageRelations = relations(message, ({ one, many }) => ({
	channel: one(channel, { fields: [message.channelId], references: [channel.id] }),
	conversation: one(conversation, {
		fields: [message.conversationId],
		references: [conversation.id]
	}),
	author: one(user, { fields: [message.authorId], references: [user.id] }),
	attachments: many(attachment),
	reactions: many(reaction)
}));
