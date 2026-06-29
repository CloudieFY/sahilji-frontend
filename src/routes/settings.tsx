import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Settings, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const DEFAULT_POLICIES = `1. Please return the rented piece on or before the due date to avoid penalty charges.
2. Any damage, burns, or alterations to the piece will incur additional fees.
3. Booking advance is strictly non-refundable.
4. Original ID proof must be deposited at the time of pickup.

1. कृपया पेनल्टी शुल्क से बचने के लिए किराए पर ली गई ड्रेस को नियत तारीख पर या उससे पहले वापस करें।
2. ड्रेस में किसी भी प्रकार का नुकसान, जलने या बदलाव होने पर अतिरिक्त शुल्क लिया जाएगा।
3. बुकिंग एडवांस वापस नहीं किया जाएगा।
4. पिकअप के समय मूल आईडी प्रूफ जमा करना अनिवार्य है।`;

export default function SettingsPage() {
  const [policies, setPolicies] = useState("");
  const [role, setRole] = useState("admin");

  useEffect(() => {
    const saved = localStorage.getItem("rental_policies");
    if (saved !== null) {
      setPolicies(saved);
    } else {
      setPolicies(DEFAULT_POLICIES);
    }

    const savedRole = localStorage.getItem("user_role") || "admin";
    setRole(savedRole);
  }, []);

  const handleSave = () => {
    localStorage.setItem("rental_policies", policies);
    toast.success("Policies updated successfully!");
  };

  const isReadOnly = role !== "admin" && role !== "reception";

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Store Configuration</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl flex items-center gap-3">
            <Settings className="w-8 h-8 text-gold" />
            Settings & Policies
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Define the terms, conditions, and rules that will be printed at the bottom of all customer invoices.
          </p>
          {isReadOnly && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Settings are visible to employees but cannot be edited from this account.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <div className="max-w-3xl space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-3">
          <label htmlFor="policies" className="text-sm font-medium">Invoice Terms & Conditions</label>
          <Textarea
            id="policies"
            rows={10}
            value={policies}
            onChange={(e) => setPolicies(e.target.value)}
            placeholder="Enter your rules and policies here..."
            className="resize-y"
            readOnly={role !== "admin" && role !== "reception"}
          />
          <p className="text-xs text-muted-foreground">
            These rules will automatically appear at the bottom of all generated A4 and Thermal bills.
          </p>
        </div>
        {(role === "admin" || role === "reception") && (
          <Button onClick={handleSave} className="bg-gold text-gold-foreground hover:bg-gold/90">
            Save Policies
          </Button>
        )}
      </div>
    </AppShell>
  );
}