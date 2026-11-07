import { buttonVariants } from '#lib/components/ui/button/index.ts';
import { cn } from '#lib/utils.ts';

/**
 * A row in a sidebar (channels, friends, groups): a ghost button, highlighted while its page
 * is open, so hover and the open page look the same in every sidebar.
 */
export function navItemClass(active: boolean, className?: string) {
	return buttonVariants({
		variant: 'ghost',
		class: cn(
			'h-auto w-full justify-start px-2 py-1.5 font-normal has-[>svg]:px-2',
			active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
			className
		)
	});
}
