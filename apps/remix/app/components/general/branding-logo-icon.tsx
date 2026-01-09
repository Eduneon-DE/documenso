import type { HTMLAttributes } from 'react';

export type LogoProps = HTMLAttributes<HTMLImageElement> & {
  width?: number;
  height?: number;
};

export const BrandingLogoIcon = ({ className, width, height, ...props }: LogoProps) => {
  return (
    <img
      src="/static/logo.png"
      alt="Eduneon"
      className={className}
      width={width || 32}
      height={height || 32}
      style={{ objectFit: 'contain' }}
      {...props}
    />
  );
};
