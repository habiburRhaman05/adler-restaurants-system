
interface OverviewHeaderProps {
  firstName: string;
}

export function OverviewHeader({ firstName }: OverviewHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Dashboard</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1 text-slate-900 tracking-tight">
          Good day, {firstName}
        </h1>
        <p className="text-slate-500 mt-1 font-medium">Here&apos;s how things are shaping up.</p>
      </div>
     
    </header>
  );
}
