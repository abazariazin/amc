import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Globe, ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "@/lib/wallet-context";
import type { Transaction } from "@/lib/api";
import { format } from "date-fns";
import { useLocation } from "wouter";

export default function ScannerPage() {
  const { getTransaction, transactions } = useWallet();
  const [location] = useLocation();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Transaction | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-search from URL query param
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get("id");
    if (id) {
      setQuery(id);
      performSearch(id);
    }
  }, [location]);

  const performSearch = (searchQuery: string) => {
    setLoading(true);
    setError("");
    setResult(null);

    setTimeout(() => {
      const found = transactions.find(t => t.id === searchQuery || t.hash === searchQuery);
      
      if (found) {
        setResult(found);
      } else {
        setError("Transaction not found. Please check the ID or Hash.");
      }
      setLoading(false);
    }, 600);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6 md:space-y-8">
        <div className="text-center space-y-2 relative px-4">
           {result && (
             <Button variant="ghost" size="sm" className="absolute left-0 top-1/2 -translate-y-1/2 md:hidden" onClick={() => setResult(null)}>
               <ChevronLeft className="h-4 w-4" />
             </Button>
           )}
          <h1 className="text-2xl md:text-3xl font-display font-bold">Transaction Scanner</h1>
          <p className="text-sm md:text-base text-muted-foreground">Enter a transaction hash or ID to view details</p>
        </div>

        <Card className="border-border/50 shadow-lg mx-2 md:mx-0">
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input 
                  placeholder="Tx Hash or ID" 
                  className="pl-9 h-10 md:h-12 text-base md:text-lg"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" className="h-10 md:h-12 px-4 md:px-8" disabled={loading}>
                {loading ? "..." : "Scan"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <div className="mx-2 md:mx-0 p-4 rounded-lg bg-destructive/10 text-destructive text-center text-sm animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        {result && (
          <Card className="mx-2 md:mx-0 border-t-4 border-t-primary animate-in fade-in slide-in-from-bottom-4">
            <CardHeader className="bg-muted/30 pb-2 px-4 md:px-6">
              <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                <Globe className="text-primary" size={18} />
                Transaction Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 px-4 md:px-6">
              <div className="flex flex-col items-center justify-center py-6 border-b border-border/50">
                <div className="text-3xl md:text-4xl font-bold font-display text-primary mb-2">
                  {result.amount} {result.currency}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs md:text-sm font-medium capitalize ${
                  result.status === 'completed' ? 'bg-accent/10 text-accent' : 
                  result.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                }`}>
                  {result.status}
                </div>
              </div>

              <div className="grid gap-3 md:gap-4 text-xs md:text-sm">
                <DetailRow label="Tx ID" value={result.id} copyable />
                <DetailRow label="Hash" value={result.hash} copyable />
                <DetailRow label="Type" value={result.type} className="capitalize" />
                <DetailRow label="Time" value={format(new Date(result.date), "PPP p")} />
                {result.from && <DetailRow label="From" value={result.from} copyable />}
                {result.to && <DetailRow label="To" value={result.to} copyable />}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function DetailRow({ label, value, className, copyable }: { label: string, value: string | number, className?: string, copyable?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!copyable) return;
    navigator.clipboard.writeText(String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col md:flex-row md:justify-between md:items-center py-3 border-b border-border/30 last:border-0 hover:bg-muted/20 px-2 rounded-sm transition-colors gap-1 md:gap-0">
      <span className="text-muted-foreground font-medium">{label}</span>
      <div 
        className={`font-mono text-foreground md:text-right break-all text-[11px] md:text-sm ${className} ${copyable ? 'cursor-pointer hover:text-primary transition-colors flex items-center gap-2 md:justify-end' : ''}`}
        onClick={handleCopy}
      >
        <span>{value}</span>
        {copyable && (
           copied ? <span className="text-accent text-[10px] whitespace-nowrap">Copied</span> : null
        )}
      </div>
    </div>
  );
}
