import { Badge } from "@/components/ui/badge";

interface CategoryBadgesProps {
  categories: Record<string, string[]>;
  results?: any;
  selectedQuestion?: any;
}

export function CategoryBadges({ categories, results, selectedQuestion }: CategoryBadgesProps) {
  if (!results?.signals || !selectedQuestion?.signal_chips) {
    return null;
  }

  // Calculate category counts based on current results
  const categoryCounts: Record<string, number> = {};
  
  // For each signal that has a status (pass/fail/caution), count it towards its category
  results.signals.forEach((signal: any) => {
    if (signal.status !== "inactive") {
      // Find which category this signal belongs to
      Object.entries(categories).forEach(([categoryName, signalNames]) => {
        if (signalNames.includes(signal.check)) {
          categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
        }
      });
    }
  });

  const activeCategoriesArray = Object.entries(categoryCounts)
    .filter(([_, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  if (activeCategoriesArray.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-600">Active Categories:</p>
      <div className="flex flex-wrap gap-2">
        {activeCategoriesArray.map(([categoryName, count]) => (
          <Badge 
            key={categoryName}
            variant="outline"
            className="text-xs bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
            data-testid={`category-badge-${categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
          >
            {categoryName} · {count}
          </Badge>
        ))}
      </div>
    </div>
  );
}