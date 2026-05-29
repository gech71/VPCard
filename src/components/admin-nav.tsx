import Link from "next/link";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "User Management" },
  { href: "/admin/requests", label: "Card Requests" },
  { href: "/admin/audit", label: "Audit Logs" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/customer-mapping", label: "Customer Mapping" },
] as const;

type AdminNavProps = {
  activePath: string;
};

export default function AdminNav({ activePath }: AdminNavProps) {
  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-6 overflow-x-auto">
          {links.map((link) => {
            const isActive = activePath === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap py-4 px-2 border-b-2 transition ${
                  isActive
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-gray-500 hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
