import Image from "next/image";

// Shared avatar treatment for employees, used anywhere an employee's name is
// shown (dropdowns, tables, hover cards, chips, etc). Same convention used
// across the app (navbar, employees page, dashboard, live tracking):
// employee.photo is a filename served through the authenticated
// /api/files/employees route; fall back to the shared default-avatar image
// when nothing has been uploaded.
export default function EmployeeAvatar({
  name,
  photo,
  size = 28,
  className = "",
}: {
  name: string;
  photo?: string | null;
  /** Pixel size (width & height) of the avatar. Defaults to 28px. */
  size?: number;
  className?: string;
}) {
  const src = photo ? `/api/files/employees/${encodeURIComponent(photo)}` : "/default-avatar.jpg";
  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      unoptimized
      className={`shrink-0 rounded-full border object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// Small inline "name + avatar" pairing, for anywhere a bare employee name
// string is currently rendered as text (table cells, hover-card lists, chips).
export function EmployeeNameTag({
  name,
  photo,
  empId,
  size = 22,
  className = "",
}: {
  name: string;
  photo?: string | null;
  /** Optional empId shown in parentheses after the name, matching existing UI. */
  empId?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <EmployeeAvatar name={name} photo={photo} size={size} />
      <span>
        {name}
        {empId ? <span className="text-muted-foreground"> ({empId})</span> : null}
      </span>
    </span>
  );
}