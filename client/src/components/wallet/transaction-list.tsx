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
  
  // Detect if this is an auto-swap transaction (swap from BTC/ETH to AMC)
  const isAutoSwap = tx.type === "swap" && (tx.currency === "BTC" || tx.currency === "ETH");
  
  const getIcon = () => {
    switch (tx.type) {
      case "send": return <ArrowUpRight className="text-foreground" size={20} />;
      case "receive": return <ArrowDownLeft className="text-foreground" size={20} />;
      case "buy": return <ShoppingCart className="text-foreground" size={20} />;
      case "swap": return <RefreshCw className={`${isAutoSwap ? 'text-primary' : 'text-foreground'}`} size={20} />;
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
    if (tx.type === "swap") {
      // Auto-swap: Show "Swap BTC To AMC" or "Swap ETH To AMC"
      if (isAutoSwap) {
        return `Swap ${tx.currency} To AMC`;
      }
      // Regular swap: Show the currency being swapped
      return `Swap ${tx.currency}`;
    }
    return `${tx.type} ${tx.currency}`;
  };

  return (
    <div className={`flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer group ${
      isAutoSwap ? 'bg-primary/5 border-l-2 border-l-primary' : ''
    }`}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border shadow-sm group-hover:scale-105 transition-transform flex-shrink-0 ${
          isAutoSwap ? 'bg-primary/10 border-primary/20' : ''
        }`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-medium capitalize ${isAutoSwap ? 'text-primary font-semibold' : ''}`}>
              {getDisplayTitle()}
            </p>
            {isAutoSwap && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/20 text-primary">
                AUTO
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(tx.date), "MMM d, yyyy • h:mm a")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          {isAutoSwap ? (
            // For auto-swap, show the amount being swapped out
            <div>
              <p className="font-bold text-foreground">
                -{parseFloat(tx.amount).toLocaleString(undefined, { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 8 
                })} {tx.currency}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Converted to AMC
              </p>
            </div>
          ) : (
            // Regular transaction display
            <div>
              <p className={`font-bold ${isIncoming ? 'text-accent' : 'text-foreground'}`}>
                {isIncoming ? '+' : '-'}{parseFloat(tx.amount).toLocaleString(undefined, { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 8 
                })} {tx.currency}
              </p>
              <p className={`text-xs capitalize flex items-center justify-end gap-1 ${getStatusColor()}`}>
                {tx.status}
              </p>
            </div>
          )}
        </div>
        <ChevronRight className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" size={16} />
      </div>
    </div>
  );
}
