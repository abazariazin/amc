import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/lib/wallet-context";
import type { Transaction } from "@/lib/api";
import { ArrowUpRight, ArrowDownLeft, ShoppingCart, RefreshCw, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export function RecentTransactions() {
  const { transactions } = useWallet();

  return (
    <Card className="border-none shadow-sm bg-card/50">
      <CardHeader>
        <CardTitle className="text-lg">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {transactions.map((tx) => (
            <Link key={tx.id} href={`/scanner?id=${tx.id}`}>
              <div className="block">
                <TransactionRow tx={tx} />
              </div>
            </Link>
          ))}
          {transactions.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No transactions yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isIncoming = tx.type === "receive" || tx.type === "buy";
  
  const getIcon = () => {
    switch (tx.type) {
      case "send": return <ArrowUpRight className="text-foreground" size={20} />;
      case "receive": return <ArrowDownLeft className="text-foreground" size={20} />;
      case "buy": return <ShoppingCart className="text-foreground" size={20} />;
      case "swap": return <RefreshCw className="text-foreground" size={20} />;
    }
  };

  const getStatusColor = () => {
    switch (tx.status) {
      case "completed": return "text-accent";
      case "pending": return "text-warning";
      case "failed": return "text-destructive";
    }
  };

  const getDisplayTitle = () => {
    if (tx.type === "swap" && tx.from && tx.to) {
      return `Swap ${tx.from} to ${tx.to}`;
    }
    return `${tx.type} ${tx.currency}`;
  };

  return (
    <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border shadow-sm group-hover:scale-105 transition-transform`}>
          {getIcon()}
        </div>
        <div>
          <p className="font-medium capitalize">{getDisplayTitle()}</p>
          <p className="text-xs text-muted-foreground">{format(new Date(tx.date), "MMM d, yyyy • h:mm a")}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className={`font-bold ${isIncoming ? 'text-accent' : 'text-foreground'}`}>
            {isIncoming ? '+' : '-'}{tx.amount} {tx.type === 'swap' ? tx.from : tx.currency}
          </p>
          <p className={`text-xs capitalize flex items-center justify-end gap-1 ${getStatusColor()}`}>
            {tx.status}
          </p>
        </div>
        <ChevronRight className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" size={16} />
      </div>
    </div>
  );
}
