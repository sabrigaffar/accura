import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  last_message: string;
  last_message_at: string;
  unread_count: number;
  created_at: string;
}

export default function SupportTicketsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const colors = theme;
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'open':
        return {
          label: 'مفتوح',
          icon: AlertCircle,
          color: colors.warning,
        };
      case 'in_progress':
        return {
          label: 'قيد المعالجة',
          icon: Clock,
          color: colors.info,
        };
      case 'resolved':
        return {
          label: 'تم الحل',
          icon: CheckCircle,
          color: colors.success,
        };
      case 'closed':
        return {
          label: 'مغلق',
          icon: XCircle,
          color: colors.textLight,
        };
      default:
        return {
          label: status,
          icon: AlertCircle,
          color: colors.textLight,
        };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return colors.error;
      case 'high':
        return colors.warning;
      case 'medium':
        return colors.info;
      case 'low':
        return colors.textLight;
      default:
        return colors.textLight;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;

    return date.toLocaleDateString('ar-SA', {
      day: 'numeric',
      month: 'short',
    });
  };

  const renderTicket = (ticket: Ticket) => {
    const statusInfo = getStatusInfo(ticket.status);
    const StatusIcon = statusInfo.icon;

    return (
      <TouchableOpacity
        key={ticket.id}
        style={styles.ticketCard}
        onPress={() =>
          router.push({
            pathname: '/support/chat' as any,
            params: {
              ticketId: ticket.id,
              ticketNumber: ticket.ticket_number,
              subject: ticket.subject,
            },
          })
        }
      >
        <View style={styles.ticketHeader}>
          <View style={styles.ticketTitleRow}>
            <Text style={styles.ticketSubject} numberOfLines={1}>
              {ticket.subject}
            </Text>
            {ticket.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{ticket.unread_count}</Text>
              </View>
            )}
          </View>
          <Text style={styles.ticketNumber}>#{ticket.ticket_number}</Text>
        </View>

        {ticket.last_message && (
          <Text style={styles.lastMessage} numberOfLines={2}>
            {ticket.last_message}
          </Text>
        )}

        <View style={styles.ticketFooter}>
          <View style={styles.ticketFooterLeft}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusInfo.color + '20' },
              ]}
            >
              <StatusIcon size={14} color={statusInfo.color} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>

            <View
              style={[
                styles.priorityDot,
                { backgroundColor: getPriorityColor(ticket.priority) },
              ]}
            />
          </View>

          <Text style={styles.timeText}>
            {formatDate(ticket.last_message_at || ticket.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تذاكر الدعم</Text>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => router.push('/support/new-ticket' as any)}
        >
          <Plus size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {tickets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MessageSquare size={64} color={colors.textLight} />
              <Text style={styles.emptyText}>لا توجد تذاكر دعم</Text>
              <Text style={styles.emptySubtext}>
                يمكنك إنشاء تذكرة جديدة للحصول على المساعدة
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => router.push('/support/new-ticket' as any)}
              >
                <Plus size={20} color={colors.white} />
                <Text style={styles.createButtonText}>إنشاء تذكرة جديدة</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.ticketsList}>
              {tickets.map((ticket) => renderTicket(ticket))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      ...typography.h2,
      color: colors.text,
    },
    newButton: {
      padding: spacing.xs,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    content: {
      flex: 1,
    },
    ticketsList: {
      padding: spacing.lg,
    },
    ticketCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ticketHeader: {
      marginBottom: spacing.sm,
    },
    ticketTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    ticketSubject: {
      ...typography.h3,
      color: colors.text,
      flex: 1,
      marginRight: spacing.sm,
    },
    ticketNumber: {
      ...typography.caption,
      color: colors.textLight,
    },
    unreadBadge: {
      backgroundColor: colors.error,
      borderRadius: borderRadius.full,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xs,
    },
    unreadText: {
      ...typography.caption,
      color: colors.white,
      fontSize: 11,
      fontWeight: '600',
    },
    lastMessage: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      lineHeight: 20,
    },
    ticketFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ticketFooterLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    statusText: {
      ...typography.caption,
      fontWeight: '600',
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    timeText: {
      ...typography.caption,
      color: colors.textLight,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing.xl * 3,
      paddingHorizontal: spacing.xl,
    },
    emptyText: {
      ...typography.h2,
      color: colors.textSecondary,
      marginTop: spacing.lg,
    },
    emptySubtext: {
      ...typography.body,
      color: colors.textLight,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      marginTop: spacing.xl,
    },
    createButtonText: {
      ...typography.bodyMedium,
      color: colors.white,
      fontWeight: '600',
    },
  });
