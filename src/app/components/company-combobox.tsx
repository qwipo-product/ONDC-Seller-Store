import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, Building2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { cn } from "./ui/utils";

/**
 * Search-as-you-type Company picker for the admin Add Seller flow
 * and the Manage Seller → Companies & Brands "Add Company" popup.
 *
 * Modeled on `SkuComboBox` so the two pickers feel like siblings:
 *   - Click the trigger → popover opens with the filtered list of
 *     companies visible by default (no need to type to see options).
 *   - Type in the search box to narrow by company name. Cmdk's
 *     built-in fuzzy match handles the matching.
 *   - Items can carry a `disabled` flag (e.g. "already added" in the
 *     Add Seller flow) which renders them greyed out with an optional
 *     reason suffix and blocks selection.
 *   - Selecting an item closes the popover and fires onChange with
 *     the chosen company id.
 */

export interface CompanyOption {
  id: string;
  name: string;
  /** Total brand count under this company, shown as a small badge so
   *  the admin can see catalog depth at a glance. */
  brandCount: number;
  /** When true the row is rendered greyed out and is not selectable. */
  disabled?: boolean;
  /** Optional short suffix shown alongside a disabled row (e.g.
   *  "Already added"). */
  disabledReason?: string;
}

interface Props {
  companies: CompanyOption[];
  /** Currently selected company id (empty string = nothing chosen). */
  value: string;
  onChange: (companyId: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  /** When true the trigger itself is non-interactive. Useful while the
   *  parent is awaiting a network round-trip. */
  disabled?: boolean;
  /** Hide the "N brands" subtitle in each row. Default true so existing
   *  callers (Add Seller, Companies & Brands) keep the brand-count
   *  hint; the serviceability dialog opts out for a leaner row. */
  showBrandCount?: boolean;
}

export function CompanyComboBox({
  companies,
  value,
  onChange,
  placeholder = "Search company by name…",
  emptyMessage = "No matching company found.",
  className,
  disabled,
  showBrandCount = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => companies.find((c) => c.id === value),
    [companies, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal bg-white",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Search className="h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">
              {selected ? selected.name : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)]"
        align="start"
      >
        <Command
          filter={(value, search) => {
            if (!search) return 1;
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={placeholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {companies.map((c) => {
                const isSel = c.id === value;
                return (
                  <CommandItem
                    key={c.id}
                    // Cmdk filters by this value-string.
                    value={`${c.name}`}
                    disabled={c.disabled}
                    onSelect={() => {
                      if (c.disabled) return;
                      onChange(c.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-start gap-2",
                      c.disabled && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-1 h-4 w-4 shrink-0",
                        isSel ? "opacity-100 text-blue-600" : "opacity-0",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {c.name}
                        </span>
                        {c.disabled && c.disabledReason && (
                          <span className="text-[11px] text-amber-700">
                            ({c.disabledReason})
                          </span>
                        )}
                      </div>
                      {showBrandCount && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {c.brandCount}{" "}
                          {c.brandCount === 1 ? "brand" : "brands"}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
