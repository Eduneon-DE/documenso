import { type HTMLAttributes, useEffect, useState } from 'react';

import { MenuIcon, SearchIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { getRootHref } from '@documenso/lib/utils/params';
import { cn } from '@documenso/ui/lib/utils';

import { BrandingLogo } from '~/components/general/branding-logo';

import { AppCommandMenu } from './app-command-menu';
import { AppNavDesktop } from './app-nav-desktop';
import { AppNavMobile } from './app-nav-mobile';

export type HeaderProps = HTMLAttributes<HTMLDivElement>;

export const Header = ({ className, ...props }: HeaderProps) => {
  const params = useParams();

  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', onScroll);

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'supports-backdrop-blur:bg-background/60 sticky top-0 z-[60] flex h-16 w-full items-center border-b border-b-transparent bg-background/95 backdrop-blur duration-200',
        scrollY > 5 && 'border-b-border',
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-x-4 px-4 md:justify-normal md:px-8">
        <Link
          to={getRootHref(params)}
          className="hidden rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inline"
        >
          <BrandingLogo className="h-6 w-auto" />
        </Link>

        <AppNavDesktop setIsCommandMenuOpen={setIsCommandMenuOpen} />

        <div className="flex flex-row items-center space-x-4 md:hidden">
          <button onClick={() => setIsCommandMenuOpen(true)}>
            <SearchIcon className="h-6 w-6 text-muted-foreground" />
          </button>

          <button onClick={() => setIsHamburgerMenuOpen(true)}>
            <MenuIcon className="h-6 w-6 text-muted-foreground" />
          </button>

          <AppCommandMenu open={isCommandMenuOpen} onOpenChange={setIsCommandMenuOpen} />

          <AppNavMobile
            isMenuOpen={isHamburgerMenuOpen}
            onMenuOpenChange={setIsHamburgerMenuOpen}
          />
        </div>
      </div>
    </header>
  );
};
