interface Suggestion {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  createdAt: any;
  status: 'pending' | 'planned' | 'in-progress' | 'completed' | 'declined';
  upvotes: number;
  upvotedBy: string[];
}
