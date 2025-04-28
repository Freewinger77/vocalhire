import React, { useState, useCallback, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Response } from "@/types/response";
import { CandidateStatus } from "@/lib/enum";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TableData = Response & {
  weightedScore: number;
};

interface DataTableProps {
  data: TableData[];
  interviewId: string;
  selectedCallId?: string;
  onRowClick?: (response: TableData) => void;
  handleCandidateStatusChange?: (callId: string, newStatus: string) => void;
}

export function DataTable({ data, interviewId, selectedCallId, onRowClick, handleCandidateStatusChange }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "weightedScore", desc: true },
  ]);

  const customSortingFn = (a: any, b: any) => {
    if (a === null || a === undefined) {
      return -1;
    }
    if (b === null || b === undefined) {
      return 1;
    }

    return a - b;
  };

  const columns: ColumnDef<TableData>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className={`w-full justify-start font-semibold text-[15px] mb-1 ${column.getIsSorted() ? "text-indigo-600" : "text-black"}`}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const name = row.original.name || "Anonymous";

        return (
          <div className="flex items-center justify-left min-h-[2.6em]">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-pointer mr-2 flex-shrink-0">
                    <ExternalLink
                      size={16}
                      className="text-current hover:text-indigo-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(
                          `/interviews/${interviewId}?call=${row.original.call_id}`,
                          "_blank",
                        );
                      }}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-gray-500 text-white font-normal"
                >
                  View Response
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="truncate">{name}</span>
          </div>
        );
      },
      sortingFn: (rowA: any, rowB: any, columnId: string) => {
        const a = rowA.getValue(columnId) as string;
        const b = rowB.getValue(columnId) as string;

        return a.toLowerCase().localeCompare(b.toLowerCase());
      },
    },
    {
      accessorKey: "weightedScore",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className={`w-full justify-start font-semibold text-[15px] mb-1 ${column.getIsSorted() ? "text-indigo-600" : "text-black"}`}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Overall Score
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }: { row: any }) => (
        <div className="min-h-[2.6em] flex items-center justify-center font-medium">
          {row.original.analytics?.overallScore ?? "-"}
        </div>
      ),
      sortingFn: (rowA: any, rowB: any, columnId: string) => {
        const a = rowA.original.weightedScore as number | null;
        const b = rowB.original.weightedScore as number | null;
        if (a === null || a === undefined) {
          return -1;
        }
        if (b === null || b === undefined) {
          return 1;
        }

        return a - b;
      },
    },
    {
      accessorKey: "candidate_status",
      header: "Status",
      cell: ({ row }) => {
        if (!handleCandidateStatusChange) {
          return <div className="min-h-[2.6em] flex items-center justify-center text-xs text-gray-500">{row.original.candidate_status || 'No Status'}</div>;
        }
        const currentStatus = row.original.candidate_status || CandidateStatus.NO_STATUS;
        return (
          <div className="min-h-[2.6em] flex items-center justify-center">
            <Select
              value={currentStatus}
              onValueChange={(newStatus) => handleCandidateStatusChange(row.original.call_id, newStatus)}
            >
              <SelectTrigger className="w-[110px] text-xs h-8">
                <SelectValue placeholder="Set Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CandidateStatus.NO_STATUS}>No Status</SelectItem>
                <SelectItem value={CandidateStatus.NOT_SELECTED}>Rejected</SelectItem>
                <SelectItem value={CandidateStatus.POTENTIAL}>Potential</SelectItem>
                <SelectItem value={CandidateStatus.SELECTED}>Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      },
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-center">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.original.call_id === selectedCallId ? "selected" : undefined}
              className={onRowClick ? "cursor-pointer" : ""}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className="text-justify align-top py-2"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
