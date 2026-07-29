import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export class CommentService {
  /**
   * Get all comments for a specific inventory item
   */
  async getByInventoryId(inventoryItemId: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });
    if (!item) throw new AppError(404, 'Inventory item not found');

    const comments = await prisma.comment.findMany({
      where: { inventoryItemId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return comments;
  }

  /**
   * Add a new comment to an inventory item
   */
  async create(inventoryItemId: string, commentText: string, userId: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });
    if (!item) throw new AppError(404, 'Inventory item not found');

    if (!commentText || commentText.trim() === '') {
      throw new AppError(400, 'Comment text cannot be empty');
    }

    const comment = await prisma.comment.create({
      data: {
        inventoryItemId,
        userId,
        comment: commentText.trim(),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'Comment',
        entityId: comment.id,
        entityLabel: `Comment on ${item.spareId} - ${item.productName}`,
        newValue: commentText.trim(),
      },
    });

    return comment;
  }

  /**
   * Edit own comment
   */
  async update(commentId: string, commentText: string, userId: string) {
    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { user: { select: { role: true } } },
    });
    if (!existing) throw new AppError(404, 'Comment not found');

    const requestingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!requestingUser) throw new AppError(401, 'User not found');

    // Only allow editing own comment (or Super Admin)
    if (existing.userId !== userId && requestingUser.role !== 'SUPER_ADMIN' && requestingUser.role !== 'ADMIN') {
      throw new AppError(403, 'You can only edit your own comments');
    }

    if (!commentText || commentText.trim() === '') {
      throw new AppError(400, 'Comment text cannot be empty');
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { comment: commentText.trim() },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'Comment',
        entityId: commentId,
        entityLabel: `Updated comment`,
        oldValue: existing.comment,
        newValue: commentText.trim(),
      },
    });

    return updated;
  }
}

export const commentService = new CommentService();
