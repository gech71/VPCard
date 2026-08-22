"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import EmptyState from "@/components/empty-state";
import DataPagination from "@/components/data-pagination";
import TableSkeleton from "@/components/table-skeleton";
import { usePagination } from "@/hooks/use-pagination";
import {
  ACTIVATION_STATE_LABEL,
  type EcommerceActivationState,
} from "@/lib/ecommerce-eligibility";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";

interface ActivationCard {
  id: string;
  customerId: string | null;
  accountNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  cardProgramCode: string | null;
  cardProgramName: string | null;
  status: string;
  maskedPan: string | null;
  reviewedAt: string | null;
  createdAt: string;
  ecommerceActivated: boolean;
  ecommerceActivatedAt: string | null;
  activationState: EcommerceActivationState;
  maker: { email: string };
}

const STATE_VARIANT: Record<
  EcommerceActivationState,
  "success" | "warning" | "neutral" | "danger"
> = {
  ACTIVATED: "success",
  ELIGIBLE: "warning",
  AWAITING_APPROVAL: "neutral",
  NOT_APPLICABLE: "neutral",
  MISSING_CARD: "danger",
};

function ActivationStateBadge({ state }: { state: EcommerceActivationState }) {
  return (
    <Badge variant={STATE_VARIANT[state]} className="whitespace-nowrap">
      {state === "ACTIVATED" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : state === "ELIGIBLE" ? (
        <ShieldCheck className="h-3 w-3" />
      ) : state === "MISSING_CARD" ? (
        <AlertTriangle className="h-3 w-3" />
      ) : null}
      {ACTIVATION_STATE_LABEL[state]}
    </Badge>
  );
}

/** Card + customer identity block, shared by the table and the confirm dialog. */
function CardIdentity({ card }: { card: ActivationCard }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-foreground">{card.customerName}</p>
      <p className="truncate font-mono text-xs text-muted-foreground">
        {card.accountNumber}
      </p>
      {card.customerEmail ? (
        <p className="truncate text-xs text-muted-foreground">
          {card.customerEmail}
        </p>
      ) : null}
    </div>
  );
}

export default function EcommerceActivationPage() {
  const { toast } = useToast();
  const [cards, setCards] = useState<ActivationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [pendingCard, setPendingCard] = useState<ActivationCard | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const fetchCards = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true);
      try {
        const res = await fetch("/api/ecommerce-activation");
        const data = await res.json();
        if (!res.ok) {
          toast({
            variant: "destructive",
            title: "Error",
            description: data.error || "Failed to load cards",
          });
          return;
        }
        setCards(data.cards || []);
      } catch {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load cards",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void fetchCards();
  }, [fetchCards]);

  async function handleActivate() {
    if (!pendingCard) return;
    const card = pendingCard;

    setActivatingId(card.id);
    setPendingCard(null);

    try {
      const res = await fetch(`/api/ecommerce-activation/${card.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Activation failed",
          description: data.error || "Could not activate e-commerce",
        });
        return;
      }

      toast({
        variant: "success",
        title: "E-commerce activated",
        description: `${card.customerName} — card ${card.maskedPan ?? ""} is now enabled for online purchases.`,
      });

      await fetchCards({ silent: true });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setActivatingId(null);
    }
  }

  const eligible = useMemo(
    () => cards.filter((c) => c.activationState === "ELIGIBLE"),
    [cards],
  );
  const activated = useMemo(
    () => cards.filter((c) => c.activationState === "ACTIVATED"),
    [cards],
  );
  const blocked = useMemo(
    () =>
      cards.filter(
        (c) =>
          c.activationState !== "ELIGIBLE" && c.activationState !== "ACTIVATED",
      ),
    [cards],
  );

  const applyFilter = useCallback(
    (list: ActivationCard[]) => {
      const term = filter.trim().toLowerCase();
      if (!term) return list;
      return list.filter(
        (c) =>
          c.customerName.toLowerCase().includes(term) ||
          c.accountNumber.toLowerCase().includes(term) ||
          c.customerEmail?.toLowerCase().includes(term) ||
          c.maskedPan?.toLowerCase().includes(term),
      );
    },
    [filter],
  );

  const filteredEligible = useMemo(
    () => applyFilter(eligible),
    [applyFilter, eligible],
  );
  const filteredActivated = useMemo(
    () => applyFilter(activated),
    [applyFilter, activated],
  );
  const filteredBlocked = useMemo(
    () => applyFilter(blocked),
    [applyFilter, blocked],
  );

  const eligiblePagination = usePagination(filteredEligible, 10);
  const activatedPagination = usePagination(filteredActivated, 10);
  const blockedPagination = usePagination(filteredBlocked, 10);

  function renderTable(
    list: ActivationCard[],
    source: ActivationCard[],
    pagination: ReturnType<typeof usePagination<ActivationCard>>,
    opts: { showAction: boolean; emptyTitle: string; emptyBody: string },
  ) {
    if (loading) {
      return (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Customer</TableHead>
              <TableHead>Card</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableSkeleton columns={5} />
          </TableBody>
        </Table>
      );
    }

    if (source.length === 0) {
      return (
        <EmptyState
          icon={ShoppingCart}
          title={opts.emptyTitle}
          description={opts.emptyBody}
        />
      );
    }

    if (list.length === 0) {
      return (
        <EmptyState
          icon={SearchX}
          title="No matching cards"
          description="Try a different customer, account number or card number."
          action={
            <Button variant="outline" size="sm" onClick={() => setFilter("")}>
              Clear search
            </Button>
          }
        />
      );
    }

    return (
      <>
        {/* Desktop */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Customer</TableHead>
                <TableHead>Card</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.pageItems.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    <CardIdentity card={card} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-sm">
                    {card.maskedPan ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {card.cardProgramName || card.cardProgramCode || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <ActivationStateBadge state={card.activationState} />
                      {card.ecommerceActivatedAt ? (
                        <p className="text-xs text-muted-foreground">
                          {new Date(card.ecommerceActivatedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {opts.showAction ? (
                        <Button
                          size="sm"
                          onClick={() => setPendingCard(card)}
                          disabled={activatingId === card.id}
                        >
                          {activatingId === card.id ? (
                            <>
                              <Loader2 className="animate-spin" />
                              Activating…
                            </>
                          ) : (
                            <>
                              <ShoppingCart />
                              Activate E-Commerce
                            </>
                          )}
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile */}
        <div className="divide-y divide-border md:hidden">
          {pagination.pageItems.map((card) => (
            <div key={card.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <CardIdentity card={card} />
                <ActivationStateBadge state={card.activationState} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Card</dt>
                  <dd className="truncate font-mono text-foreground">
                    {card.maskedPan ?? "—"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Product</dt>
                  <dd className="truncate text-foreground">
                    {card.cardProgramName || card.cardProgramCode || "—"}
                  </dd>
                </div>
              </dl>
              {opts.showAction ? (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setPendingCard(card)}
                  disabled={activatingId === card.id}
                >
                  {activatingId === card.id ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Activating…
                    </>
                  ) : (
                    <>
                      <ShoppingCart />
                      Activate E-Commerce
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <DataPagination pagination={pagination} itemLabel="cards" />
      </>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="E-Commerce Activation"
        description="Approved cards are issued with e-commerce disabled. Review the card here and activate online purchases explicitly."
        actions={
          <>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search customer or card"
                aria-label="Search cards"
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => void fetchCards()}
              disabled={loading}
            >
              <RefreshCw className={loading ? "animate-spin" : undefined} />
              Refresh
            </Button>
          </>
        }
      />

      <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Ready to activate"
          value={eligible.length}
          icon={ShieldCheck}
          tone="warning"
          hint="Awaiting your action"
          isLoading={loading}
        />
        <StatCard
          label="E-commerce active"
          value={activated.length}
          icon={CheckCircle2}
          tone="success"
          hint="Online purchases enabled"
          isLoading={loading}
        />
        <StatCard
          label="Not eligible"
          value={blocked.length}
          icon={AlertTriangle}
          tone="neutral"
          hint="Missing card or not approved"
          isLoading={loading}
        />
      </div>

      <Tabs defaultValue="eligible" className="w-full">
        <TabsList>
          <TabsTrigger value="eligible">
            Ready to activate
            <span className="rounded-full bg-warning-muted px-1.5 text-xs font-semibold tabular-nums text-warning-muted-foreground">
              {eligible.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="activated">
            Activated
            <span className="rounded-full bg-success-muted px-1.5 text-xs font-semibold tabular-nums text-success-muted-foreground">
              {activated.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="blocked">
            Not eligible
            <span className="rounded-full bg-muted-foreground/15 px-1.5 text-xs font-semibold tabular-nums">
              {blocked.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eligible">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Cards ready for e-commerce</CardTitle>
              <CardDescription>
                These cards were approved and created at PSS with e-commerce
                disabled. Activating sends the request to PSS immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {renderTable(filteredEligible, eligible, eligiblePagination, {
                showAction: true,
                emptyTitle: "Nothing waiting for activation",
                emptyBody:
                  "Approved cards assigned to you will appear here once they have a card number.",
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activated">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Activated cards</CardTitle>
              <CardDescription>
                Cards you have already enabled for online purchases.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {renderTable(filteredActivated, activated, activatedPagination, {
                showAction: false,
                emptyTitle: "No cards activated yet",
                emptyBody:
                  "Once you activate a card it will be listed here with its activation time.",
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Not eligible</CardTitle>
              <CardDescription>
                Approved requests that cannot be activated yet, with the reason.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {renderTable(filteredBlocked, blocked, blockedPagination, {
                showAction: false,
                emptyTitle: "Nothing blocked",
                emptyBody:
                  "Every approved card assigned to you has a usable card number.",
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation before an irreversible outbound PSS call */}
      <AlertDialog
        open={pendingCard !== null}
        onOpenChange={(open) => !open && setPendingCard(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate e-commerce?</AlertDialogTitle>
            <AlertDialogDescription>
              This enables online (card-not-present) purchases for the card
              below by sending an activation request to PSS. It cannot be undone
              from this screen.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingCard ? (
            <dl className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Customer</dt>
                <dd className="truncate text-sm font-medium text-foreground">
                  {pendingCard.customerName}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Account</dt>
                <dd className="truncate font-mono text-sm text-foreground">
                  {pendingCard.accountNumber}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Card</dt>
                <dd className="truncate font-mono text-sm text-foreground">
                  {pendingCard.maskedPan ?? "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Product</dt>
                <dd className="truncate text-sm text-foreground">
                  {pendingCard.cardProgramName ||
                    pendingCard.cardProgramCode ||
                    "—"}
                </dd>
              </div>
            </dl>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleActivate()}>
              <ShoppingCart />
              Activate E-Commerce
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
