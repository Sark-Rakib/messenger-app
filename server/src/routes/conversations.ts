import { Router, Request, Response } from 'express';
import { PrismaClient, ConversationType } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const formattedConversations = conversations.map((conv) => {
      const otherParticipants = conv.participants.filter((p) => p.userId !== userId);
      return {
        id: conv.id,
        type: conv.type,
        name: conv.type === ConversationType.GROUP ? conv.name : null,
        avatar: conv.avatar,
        participants: conv.participants.map((p) => p.user),
        lastMessage: conv.messages[0] || null,
        updatedAt: conv.updatedAt,
      };
    });

    res.json(formattedConversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { participantIds, type, name } = req.body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      res.status(400).json({ error: 'Participant IDs are required' });
      return;
    }

    if (type === ConversationType.DIRECT && participantIds.length === 1) {
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          type: ConversationType.DIRECT,
          AND: [
            {
              participants: {
                some: { userId },
              },
            },
            {
              participants: {
                some: { userId: participantIds[0] },
              },
            },
          ],
        },
      });

      if (existingConversation) {
        const fullConversation = await prisma.conversation.findUnique({
          where: { id: existingConversation.id },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        });
        res.json(fullConversation);
        return;
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        type: type || ConversationType.DIRECT,
        name: type === ConversationType.GROUP ? name : null,
        participants: {
          create: [
            { userId },
            ...participantIds.map((id: string) => ({ userId: id })),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json(conversation);
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

router.post('/:id/participants', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const { userIds } = req.body;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        type: ConversationType.GROUP,
        participants: {
          some: { userId, role: 'ADMIN' },
        },
      },
    });

    if (!conversation) {
      res.status(403).json({ error: 'Not authorized to add participants' });
      return;
    }

    await prisma.conversationParticipant.createMany({
      data: userIds.map((id: string) => ({
        userId: id,
        conversationId,
      })),
      skipDuplicates: true,
    });

    res.json({ message: 'Participants added' });
  } catch (error) {
    console.error('Add participants error:', error);
    res.status(500).json({ error: 'Failed to add participants' });
  }
});

export default router;
