export default function PageHeader({ title }: { title: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-linear-to-r from-cyan-950 via-sky-800 to-sky-400 px-5 py-4 text-white shadow-md shadow-sky-950/10">
      <div className="absolute -right-8 -top-12 size-32 rounded-full bg-white/10" />
      <h1 className="relative text-xl font-semibold tracking-tight">{title}</h1>
      <p className="relative mt-0.5 text-xs text-sky-100">Manage and review your {title.toLowerCase()} workspace</p>
    </div>
  );
}
