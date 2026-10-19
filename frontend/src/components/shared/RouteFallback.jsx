import { useLocation } from 'react-router';
import { Skeleton, SkeletonCard } from '../ui';
import { TopProgress } from './TopProgress';

const WORKSPACE = /^\/(reader|author|moderator|admin|read|listen|library)(\/|$)/;

/* Suspense fallback while a route chunk downloads: skeleton of the shell the route will use. */
export function RouteFallback() {
  const { pathname } = useLocation();
  const workspace = WORKSPACE.test(pathname);
  return (
    <div aria-busy="true" className="min-h-[100dvh] bg-page">
      <TopProgress active />
      {workspace ? (
        <div className="flex">
          <div className="hidden w-64 shrink-0 space-y-3 border-r border-hairline p-4 lg:block">
            <Skeleton className="h-10 w-36 rounded-2xl" />
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full rounded-2xl" />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex h-16 items-center gap-3 border-b border-hairline px-5">
              <Skeleton className="h-10 w-full max-w-md" />
              <Skeleton className="ml-auto size-10" />
              <Skeleton className="size-10" />
            </div>
            <PageBody />
          </div>
        </div>
      ) : (
        <>
          <div className="px-3 pt-3 sm:px-4 md:px-6 lg:px-10">
            <Skeleton className="mx-auto h-16 max-w-[1360px]" />
          </div>
          <PageBody />
        </>
      )}
    </div>
  );
}

function PageBody() {
  return (
    <div className="mx-auto max-w-[1360px] space-y-6 px-5 py-8 md:px-8">
      <Skeleton className="h-9 w-72 max-w-full rounded-2xl" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} lines={1} />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <SkeletonCard media lines={3} className="lg:col-span-2" />
        <SkeletonCard lines={4} />
      </div>
    </div>
  );
}
