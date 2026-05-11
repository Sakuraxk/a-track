import { Icon as IconifyIcon, IconProps as IconifyIconProps } from '@iconify/react';
import { cn } from '@/lib/utils';

export interface IconProps extends Omit<IconifyIconProps, 'icon'> {
  icon: string;
  className?: string;
}

export function Icon({ icon, className, ...props }: IconProps) {
  return (
    <IconifyIcon
      icon={icon}
      className={cn("inline-block flex-shrink-0", className)}
      {...props}
    />
  );
}
