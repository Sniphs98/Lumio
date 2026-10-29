import { relations, sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	bigint,
	boolean,
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
/*                                  Instance                                  */
/* -------------------------------------------------------------------------- */

/**
 * One Lumio instance is one self-contained community. This table holds exactly one row,
 * created when the first user signs up; that user becomes the owner.
 * Clients connect to several instances and show each one as a tab.
 */
export const instance = pgTable('instance', {
	id: integer('id').primaryKey().default(1),
	name: text('name').notNull(),
	iconUrl: text('icon_url'),
	ownerId: text('owner_id')
		.notNull()
		.references(() => user.id, { onDelete: 'restrict' }),
	/** Largest file members may upload, in bytes. Set by the owner in the server settings. */
	maxUploadSize: bigint('max_upload_size', { mode: 'number' })
		.notNull()
		.default(2 * 1024 ** 3),
	/**
	 * Public servers let guests invite people like members do. On private servers (the default)
	 * guests cannot create invite links, and their friend links only work for existing members.
	 */
	isPublic: boolean('is_public').notNull().default(false),
	/** Whether the storage per person below is enforced. */
	uploadQuotaEnabled: boolean('upload_quota_enabled').notNull().default(true),
	/** Total size of the files a member may have shared, in bytes. */
	memberUploadQuota: bigint('member_upload_quota', { mode: 'number' })
		.notNull()
		.default(5 * 1024 ** 3),
	/** Total size of the files a guest may have shared, in bytes. */
	guestUploadQuota: bigint('guest_upload_quota', { mode: 'number' })
		.notNull()
		.default(1024 ** 3),
	...timestamps
});

/**
 * Users banned from the instance. They cannot sign in until a moderator lifts the ban.
 */
export const ban = pgTable('ban', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	bannedById: text('banned_by_id').references(() => user.id, { onDelete: 'set null' }),
	reason: text('reason'),
	...timestamps
});

/**
 * Permissions are stored as a bit mask, see `#lib/permissions.ts`.
 * The `@everyone` role applies to every user and has `position = 0`.
 */
export const role = pgTable('role', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	color: text('color'),
	position: integer('position').notNull().default(0),
	permissions: bigint('permissions', { mode: 'bigint' })
		.notNull()
		.default(sql`0`),
	...timestamps
});

export const userRole = pgTable(
	'user_role',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		roleId: uuid('role_id')
			.notNull()
			.references(() => role.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.userId, t.roleId] })]
);

export const invite = pgTable('invite', {
	code: text('code').primaryKey(),
	createdById: text('created_by_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	maxUses: integer('max_uses'),
	uses: integer('uses').notNull().default(0),
	expiresAt: timestamp('expires_at', { withTimezone: true }),
	/** Whether people may join as a guest (only a name) instead of creating an account. */
	allowGuests: boolean('allow_guests').notNull().default(true),
	...timestamps
});

/* -------------------------------------------------------------------------- */
/*                                  Channels                                  */
/* -------------------------------------------------------------------------- */

export const channelType = pgEnum('channel_type', ['category', 'text', 'voice']);

export const channel = pgTable('channel', {
	id: uuid('id').primaryKey().defaultRandom(),
	/** Category this channel belongs to, if any. */
	parentId: uuid('parent_id'),
	type: channelType('type').notNull(),
	name: text('name').notNull(),
	topic: text('topic'),
	position: integer('position').notNull().default(0),
	...timestamps
});

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

/**
 * Every user's personal friend link. Whoever opens it becomes their friend right away;
 * newcomers can join the instance through it first. Resetting the link replaces the code.
 */
export const friendLink = pgTable('friend_link', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	code: text('code').notNull().unique(),
	...timestamps
});

export const conversationType = pgEnum('conversation_type', ['direct', 'group']);

/** A 1:1 chat with a friend, or a group chat. Kept separate from server channels. */
export const conversation = pgTable('conversation', {
	id: uuid('id').primaryKey().defaultRandom(),
	type: conversationType('type').notNull(),
	/** Only used for group conversations. */
	name: text('name'),
	/**
	 * Only used for group conversations: the member who may remove others. Passes to the
	 * longest-standing member when the owner leaves.
	 */
	ownerId: text('owner_id').references(() => user.id, { onDelete: 'set null' }),
	/**
	 * Only used for direct conversations: both user ids, sorted and joined by `:`.
	 * Unique, so two users always share exactly one direct conversation.
	 */
	directKey: text('direct_key').unique(),
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
			.references(() => user.id, { onDelete: 'cascade' }),
		joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull()
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
		/** The message this one answers. Kept as an empty reply if that message is deleted. */
		replyToId: uuid('reply_to_id').references((): AnyPgColumn => message.id, {
			onDelete: 'set null'
		}),
		editedAt: timestamp('edited_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [
		index('message_channel_created_idx').on(t.channelId, t.createdAt),
		index('message_conversation_created_idx').on(t.conversationId, t.createdAt)
	]
);

/**
 * A file shared in a chat. The row is created when its upload finishes, before the message is sent:
 * `messageId` stays empty until the uploader sends a message with it. The file itself lives in the
 * upload store (a folder on the instance or an S3 bucket) under the attachment's id.
 */
export const attachment = pgTable(
	'attachment',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		messageId: uuid('message_id').references(() => message.id, { onDelete: 'cascade' }),
		uploaderId: text('uploader_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** The chat the file was uploaded for; it can only be sent there. */
		channelId: uuid('channel_id').references(() => channel.id, { onDelete: 'cascade' }),
		conversationId: uuid('conversation_id').references(() => conversation.id, {
			onDelete: 'cascade'
		}),
		fileName: text('file_name').notNull(),
		mimeType: text('mime_type').notNull(),
		size: bigint('size', { mode: 'number' }).notNull(),
		...timestamps
	},
	(t) => [
		index('attachment_message_idx').on(t.messageId),
		index('attachment_uploader_idx').on(t.uploaderId)
	]
);

export const reaction = pgTable(
	'reaction',
	{
		messageId: uuid('message_id')
			.notNull()
			.references(() => message.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		emoji: text('emoji').notNull(),
		...timestamps
	},
	(t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })]
);

/**
 * Users a message mentions: those written as `<@userId>` in its content, plus the author of the
 * message it replies to. Drives mention highlights and mention counts.
 */
export const messageMention = pgTable(
	'message_mention',
	{
		messageId: uuid('message_id')
			.notNull()
			.references(() => message.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(t) => [
		primaryKey({ columns: [t.messageId, t.userId] }),
		index('message_mention_user_idx').on(t.userId)
	]
);

/**
 * Last message a user has read, per channel or conversation. Messages from others after
 * `lastReadAt` are unread; without a row, everything since the user signed up is.
 */
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
		/** When the last read message was sent. */
		lastReadAt: timestamp('last_read_at', { withTimezone: true }),
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

export const channelRelations = relations(channel, ({ many }) => ({
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

export const attachmentRelations = relations(attachment, ({ one }) => ({
	message: one(message, { fields: [attachment.messageId], references: [message.id] })
}));
