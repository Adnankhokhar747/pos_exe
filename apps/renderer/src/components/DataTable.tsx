import { useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { SearchInput } from './SearchInput';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  sortable?: boolean;
  /** Value used for sorting; falls back to `row[key]` when omitted. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Plain-text representation of a row used by the built-in search box. */
  getSearchText?: (row: T) => string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  rowsPerPageOptions?: number[];
  defaultRowsPerPage?: number;
  maxHeight?: number | string;
  selectedRowId?: string;
  onRowClick?: (row: T) => void;
  hideSearch?: boolean;
  /** Extra controls (filter buttons, date pickers, etc.) rendered next to the search box. */
  toolbar?: ReactNode;
  dense?: boolean;
  isLoading?: boolean;
}

// Shared table primitive: sticky header, client-side sort/search/pagination,
// and zebra-striped rows so every data grid in the app behaves identically.
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  getSearchText,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No records found.',
  defaultSortKey,
  defaultSortDir = 'asc',
  rowsPerPageOptions = [10, 25, 50],
  defaultRowsPerPage = 10,
  maxHeight = 520,
  selectedRowId,
  onRowClick,
  hideSearch = false,
  toolbar,
  dense = true,
  isLoading = false,
}: DataTableProps<T>): JSX.Element {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);

  const safeRows = Array.isArray(rows) ? rows : [];

  const filteredRows = useMemo(() => {
    if (!search.trim()) return safeRows;
    const needle = search.trim().toLowerCase();
    return safeRows.filter((row) => {
      const text = getSearchText ? getSearchText(row) : JSON.stringify(row);
      return text.toLowerCase().includes(needle);
    });
  }, [safeRows, search, getSearchText]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const column = columns.find((c) => c.key === sortKey);
    if (!column) return filteredRows;
    const valueOf = (row: T): string | number => {
      if (column.sortValue) return column.sortValue(row);
      const raw = (row as Record<string, unknown>)[column.key];
      return typeof raw === 'number' ? raw : String(raw ?? '');
    };
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    if (sortDir === 'desc') copy.reverse();
    return copy;
  }, [filteredRows, sortKey, sortDir, columns]);

  const pagedRows = useMemo(
    () => sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sortedRows, page, rowsPerPage],
  );

  const handleSort = (key: string): void => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <Box>
      {(!hideSearch || toolbar) && (
        <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5} flexWrap="wrap">
          {!hideSearch && (
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              sx={{ minWidth: 240 }}
            />
          )}
          {toolbar}
        </Stack>
      )}
      <TableContainer sx={{ maxHeight, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
        <Table stickyHeader size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align ?? 'left'}
                  sx={{ width: column.width, bgcolor: 'background.paper' }}
                >
                  {column.sortable ? (
                    <TableSortLabel
                      active={sortKey === column.key}
                      direction={sortKey === column.key ? sortDir : 'asc'}
                      onClick={() => handleSort(column.key)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedRows.map((row) => {
              const id = getRowId(row);
              const selected = selectedRowId === id;
              return (
                <TableRow
                  key={id}
                  hover
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  selected={selected}
                  sx={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    '&:nth-of-type(even)': { backgroundColor: (theme) => theme.palette.action.hover },
                  }}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} align={column.align ?? 'left'}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {isLoading && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && pagedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary" variant="body2">
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {sortedRows.length > 0 && (
        <TablePagination
          component="div"
          count={sortedRows.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={rowsPerPageOptions}
        />
      )}
    </Box>
  );
}
