export default function PageHeader({ title }: { title: string }) {
  return (
    <div className="bg-linear-to-r from-sky-300 to-sky-950 text-white text-center py-2 font-semibold rounded-md">
      {title}
    </div>
  );
}
