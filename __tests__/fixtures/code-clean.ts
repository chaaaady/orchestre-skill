import { getDonations } from '@/lib/queries/donations';
import { Button } from '@/components/ui/button';

type DonationResult = {
  success: boolean;
  data: unknown;
};

export async function DonationsPage() {
  const result = await getDonations();
  return (
    <div className="bg-primary text-foreground">
      <Button variant="destructive">Delete</Button>
    </div>
  );
}
