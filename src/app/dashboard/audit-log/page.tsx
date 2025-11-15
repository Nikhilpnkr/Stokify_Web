
"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, History } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import type { AuditLog } from "@/lib/data";
import { format, formatDistanceToNow } from "date-fns";

export default function AuditLogPage() {
  const { firestore, user } = useFirebase();

  const auditLogsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, 'auditLogs'), where('ownerId', '==', user.uid), orderBy('date', 'desc')) : null,
    [firestore, user]
  );
  const { data: logs, isLoading: isLoadingLogs } = useCollection<AuditLog>(auditLogsQuery);

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="A chronological history of all significant actions performed in your account."
      />
      <Card>
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
          <CardDescription>
            {logs?.length || 0} log entries found.
          </CardDescription>
        </CardHeader>
        <CardContent>
           {isLoadingLogs ? (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            </div>
            ) : logs && logs.length > 0 ? (
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => (
                    <TableRow key={log.id}>
                        <TableCell>
                            <div className="flex flex-col">
                                <span>{format(new Date(log.date), "MMM d, yyyy, HH:mm")}</span>
                                <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(log.date), { addSuffix: true })}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="font-medium">{log.action}</TableCell>
                        <TableCell className="text-muted-foreground">{log.entityType}</TableCell>
                        <TableCell>{log.details}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
            ) : (
            <div className="h-64 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center">
                <History className="h-10 w-10 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">No activity has been logged yet.</p>
            </div>
            )}
        </CardContent>
      </Card>
    </>
  );
}
