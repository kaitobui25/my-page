import { DatabaseBackup, Download } from "lucide-react";
import Link from "next/link";

export function StorageActions() {
  return (
    <div className="admin-storage-actions">
      <Link className="admin-action-button" download href="/api/admin/export" prefetch={false} title="Download portable knowledge ZIP">
        <Download aria-hidden="true" size={15} />
        Export Knowledge
      </Link>
      <Link className="admin-action-button" download href="/api/admin/backup" prefetch={false} title="Download D1 + R2 runtime backup ZIP">
        <DatabaseBackup aria-hidden="true" size={15} />
        Backup D1/R2
      </Link>
    </div>
  );
}
