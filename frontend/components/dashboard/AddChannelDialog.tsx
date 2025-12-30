'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { addChannel } from '@/lib/api';
import { Plus } from 'lucide-react';
import React, { useState } from 'react';

interface AddChannelDialogProps {
  onSuccess?: () => void;
}

export const AddChannelDialog = ({ onSuccess }: AddChannelDialogProps) => {
  const [open, setOpen] = useState(false);
  const [channelUrl, setChannelUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await addChannel(channelUrl);
      if (response.success) {
        setChannelUrl('');
        setOpen(false);
        onSuccess?.();
      } else {
        setError(response.error || 'Failed to add channel');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add channel');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setChannelUrl('');
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Add YouTuber
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New YouTuber</DialogTitle>
          <DialogDescription>
            Enter the YouTube channel URL to start tracking their predictions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="channelUrl" className="text-sm font-medium">
                Channel URL
              </label>
              <Input
                id="channelUrl"
                placeholder="https://www.youtube.com/@ChannelName"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                disabled={isLoading}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !channelUrl.trim()}>
              {isLoading ? 'Adding...' : 'Add Channel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

