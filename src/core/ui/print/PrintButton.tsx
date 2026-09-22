'use client';

import { Button } from '@/core/ui/components/Button';
import { PrintIcon } from '@/core/ui/components/Icons';

export function PrintButton({ label = 'הדפסה' }: { label?: string }) {
  return (
    <Button variant="primary" onClick={() => window.print()}>
      <PrintIcon className="size-5" />
      {label}
    </Button>
  );
}
