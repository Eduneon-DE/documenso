import type { HTMLAttributes } from 'react';

export type LogoProps = HTMLAttributes<HTMLImageElement> & {
  width?: number;
  height?: number;
};

export const BrandingLogo = ({ className, width, height, ...props }: LogoProps) => {
  return (
    <img
      src="/static/logo.png"
      alt="Eduneon"
      className={className}
      width={width || 180}
      height={height || 40}
      {...props}
    />
  );
};
