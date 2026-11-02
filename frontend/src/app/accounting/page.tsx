import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BookOpen, ListTree, ArrowRightLeft } from "lucide-react"

export default function AccountingPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Accounting Module</h1>
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <BookOpen className="h-4 w-4" /> Add Journal Entry
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Chart of Accounts</CardTitle>
            <ListTree className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage Assets, Liabilities, Equity, Income, and Expenses.</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">General Ledger</CardTitle>
            <BookOpen className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">View all double-entry transaction histories.</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Journal Entries</CardTitle>
            <ArrowRightLeft className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Create and manage manual journal entries securely.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent General Ledger Activities</h2>
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>2023-10-24 10:30</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">TRX-0091</TableCell>
                <TableCell>Cash (Asset)</TableCell>
                <TableCell>Deposit (Savings)</TableCell>
                <TableCell className="text-right font-medium">$500.00</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>2023-10-24 10:30</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">TRX-0091</TableCell>
                <TableCell>Savings Liability</TableCell>
                <TableCell>Deposit (Savings)</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
                <TableCell className="text-right font-medium">$500.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>2023-10-24 14:15</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">TRX-0092</TableCell>
                <TableCell>Loan Portfolio (Asset)</TableCell>
                <TableCell>Disbursement</TableCell>
                <TableCell className="text-right font-medium">$2,000.00</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>2023-10-24 14:15</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">TRX-0092</TableCell>
                <TableCell>Cash (Asset)</TableCell>
                <TableCell>Disbursement</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
                <TableCell className="text-right font-medium">$2,000.00</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
