export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      atl_approvals: {
        Row: {
          action_data: Json
          action_type: string
          atl_id: string
          created_at: string
          decided_at: string | null
          id: string
          rejection_reason: string | null
          status: string
          tl_id: string
        }
        Insert: {
          action_data?: Json
          action_type: string
          atl_id: string
          created_at?: string
          decided_at?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          tl_id: string
        }
        Update: {
          action_data?: Json
          action_type?: string
          atl_id?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          tl_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atl_approvals_atl_id_fkey"
            columns: ["atl_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atl_approvals_tl_id_fkey"
            columns: ["tl_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          date: string
          deduction_amount: number | null
          desk_condition: string | null
          desk_number: string | null
          id: string
          is_early_out: boolean | null
          is_late: boolean | null
          mood_in: string | null
          mood_note: string | null
          mood_out: string | null
          phone_minutes_remaining: number | null
          phone_number: string | null
          user_id: string | null
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          date: string
          deduction_amount?: number | null
          desk_condition?: string | null
          desk_number?: string | null
          id?: string
          is_early_out?: boolean | null
          is_late?: boolean | null
          mood_in?: string | null
          mood_note?: string | null
          mood_out?: string | null
          phone_minutes_remaining?: number | null
          phone_number?: string | null
          user_id?: string | null
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          date?: string
          deduction_amount?: number | null
          desk_condition?: string | null
          desk_number?: string | null
          id?: string
          is_early_out?: boolean | null
          is_late?: boolean | null
          mood_in?: string | null
          mood_note?: string | null
          mood_out?: string | null
          phone_minutes_remaining?: number | null
          phone_number?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_appeals: {
        Row: {
          attendance_id: string | null
          created_at: string | null
          decided_by: string | null
          explanation: string
          id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          attendance_id?: string | null
          created_at?: string | null
          decided_by?: string | null
          explanation: string
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          attendance_id?: string | null
          created_at?: string | null
          decided_by?: string | null
          explanation?: string
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_appeals_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_appeals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_appeals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_agent_roles: {
        Row: {
          agent_id: string
          campaign_id: string
          created_at: string | null
          id: string
          is_bronze: boolean
          is_silver: boolean
          tl_id: string
        }
        Insert: {
          agent_id: string
          campaign_id: string
          created_at?: string | null
          id?: string
          is_bronze?: boolean
          is_silver?: boolean
          tl_id: string
        }
        Update: {
          agent_id?: string
          campaign_id?: string
          created_at?: string | null
          id?: string
          is_bronze?: boolean
          is_silver?: boolean
          tl_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_agent_roles_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_agent_roles_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_agent_roles_tl_id_fkey"
            columns: ["tl_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_tls: {
        Row: {
          campaign_id: string
          tl_id: string
        }
        Insert: {
          campaign_id: string
          tl_id: string
        }
        Update: {
          campaign_id?: string
          tl_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_tls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_tls_tl_id_fkey"
            columns: ["tl_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_websites: {
        Row: {
          campaign_id: string
          created_at: string | null
          data_mode: string
          id: string
          is_active: boolean
          site_name: string
          site_url: string
          webhook_secret: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          data_mode?: string
          id?: string
          is_active?: boolean
          site_name: string
          site_url: string
          webhook_secret?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          data_mode?: string
          id?: string
          is_active?: boolean
          site_name?: string
          site_url?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_websites_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          data_mode: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          data_mode?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          data_mode?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          reactions: Json | null
          read_by: string[] | null
          reply_to_id: string | null
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          reactions?: Json | null
          read_by?: string[] | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          reactions?: Json | null
          read_by?: string[] | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          is_admin: boolean | null
          joined_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          is_admin?: boolean | null
          joined_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          is_admin?: boolean | null
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      data_requests: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          message: string | null
          requested_by: string
          responded_at: string | null
          response_note: string | null
          status: string
          tl_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          requested_by: string
          responded_at?: string | null
          response_note?: string | null
          status?: string
          tl_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          requested_by?: string
          responded_at?: string | null
          response_note?: string | null
          status?: string
          tl_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_tl_id_fkey"
            columns: ["tl_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_monthly_offs: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          id: string
          month: number
          off_date: string
          user_id: string
          year: number
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          month: number
          off_date: string
          user_id: string
          year: number
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          month?: number
          off_date?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_monthly_offs_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_monthly_offs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          agent_id: string
          group_leader_id: string
        }
        Insert: {
          agent_id: string
          group_leader_id: string
        }
        Update: {
          agent_id?: string
          group_leader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_leader_id_fkey"
            columns: ["group_leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_config: {
        Row: {
          amount_per_order: number | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          max_ratio: number | null
          min_ratio: number | null
          minimum_threshold: number | null
          role: string
          status: string | null
        }
        Insert: {
          amount_per_order?: number | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_ratio?: number | null
          min_ratio?: number | null
          minimum_threshold?: number | null
          role: string
          status?: string | null
        }
        Update: {
          amount_per_order?: number | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_ratio?: number | null
          min_ratio?: number | null
          minimum_threshold?: number | null
          role?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incentive_config_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          damaged: number | null
          dispatched: number | null
          id: string
          low_stock_threshold: number | null
          product_name: string
          returned: number | null
          stock_in: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          damaged?: number | null
          dispatched?: number | null
          id?: string
          low_stock_threshold?: number | null
          product_name: string
          returned?: number | null
          stock_in?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          damaged?: number | null
          dispatched?: number | null
          id?: string
          low_stock_threshold?: number | null
          product_name?: string
          returned?: number | null
          stock_in?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_import_logs: {
        Row: {
          campaign_id: string
          created_at: string | null
          duplicates_skipped: number
          error_message: string | null
          id: string
          imported_by: string | null
          leads_imported: number
          source: string
          status: string
          total_received: number
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          duplicates_skipped?: number
          error_message?: string | null
          id?: string
          imported_by?: string | null
          leads_imported?: number
          source?: string
          status?: string
          total_received?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          duplicates_skipped?: number
          error_message?: string | null
          id?: string
          imported_by?: string | null
          leads_imported?: number
          source?: string
          status?: string
          total_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_import_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_logs_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          agent_type: string | null
          assigned_to: string | null
          called_date: string | null
          called_time: number | null
          campaign_id: string | null
          created_at: string | null
          id: string
          import_source: string | null
          name: string | null
          phone: string | null
          requeue_at: string | null
          requeue_count: number | null
          sms_status: string | null
          source: string | null
          special_note: string | null
          status: string | null
          tl_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          agent_type?: string | null
          assigned_to?: string | null
          called_date?: string | null
          called_time?: number | null
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          import_source?: string | null
          name?: string | null
          phone?: string | null
          requeue_at?: string | null
          requeue_count?: number | null
          sms_status?: string | null
          source?: string | null
          special_note?: string | null
          status?: string | null
          tl_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          agent_type?: string | null
          assigned_to?: string | null
          called_date?: string | null
          called_time?: number | null
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          import_source?: string | null
          name?: string | null
          phone?: string | null
          requeue_at?: string | null
          requeue_count?: number | null
          sms_status?: string | null
          source?: string | null
          special_note?: string | null
          status?: string | null
          tl_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tl_id_fkey"
            columns: ["tl_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string | null
          decided_by: string | null
          end_date: string
          id: string
          reason: string | null
          start_date: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          decided_by?: string | null
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          decided_by?: string | null
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_budget: {
        Row: {
          allocated_by: string | null
          amount: number | null
          created_at: string | null
          id: string
          note: string | null
        }
        Insert: {
          allocated_by?: string | null
          amount?: number | null
          created_at?: string | null
          id?: string
          note?: string | null
        }
        Update: {
          allocated_by?: string | null
          amount?: number | null
          created_at?: string | null
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_budget_allocated_by_fkey"
            columns: ["allocated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          description: string
          expense_date: string | null
          id: string
          officer_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          description: string
          expense_date?: string | null
          id?: string
          officer_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          description?: string
          expense_date?: string | null
          id?: string
          officer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_expenses_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_holidays: {
        Row: {
          created_at: string | null
          created_by: string | null
          holiday_date: string
          id: string
          month: number
          title: string
          year: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          holiday_date: string
          id?: string
          month: number
          title?: string
          year: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          holiday_date?: string
          id?: string
          month?: number
          title?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          agent_id: string | null
          created_at: string | null
          cs_call_done_at: string | null
          cs_id: string | null
          cs_note: string | null
          cs_rating: string | null
          cso_approved_at: string | null
          cso_id: string | null
          customer_name: string | null
          delivery_status: string | null
          id: string
          lead_id: string | null
          phone: string | null
          price: number | null
          product: string | null
          quantity: number | null
          rider_name: string | null
          rider_phone: string | null
          status: string | null
          steadfast_consignment_id: string | null
          steadfast_send_failed: boolean | null
          tl_id: string | null
          warehouse_sent_at: string | null
          warehouse_sent_by: string | null
        }
        Insert: {
          address?: string | null
          agent_id?: string | null
          created_at?: string | null
          cs_call_done_at?: string | null
          cs_id?: string | null
          cs_note?: string | null
          cs_rating?: string | null
          cso_approved_at?: string | null
          cso_id?: string | null
          customer_name?: string | null
          delivery_status?: string | null
          id?: string
          lead_id?: string | null
          phone?: string | null
          price?: number | null
          product?: string | null
          quantity?: number | null
          rider_name?: string | null
          rider_phone?: string | null
          status?: string | null
          steadfast_consignment_id?: string | null
          steadfast_send_failed?: boolean | null
          tl_id?: string | null
          warehouse_sent_at?: string | null
          warehouse_sent_by?: string | null
        }
        Update: {
          address?: string | null
          agent_id?: string | null
          created_at?: string | null
          cs_call_done_at?: string | null
          cs_id?: string | null
          cs_note?: string | null
          cs_rating?: string | null
          cso_approved_at?: string | null
          cso_id?: string | null
          customer_name?: string | null
          delivery_status?: string | null
          id?: string
          lead_id?: string | null
          phone?: string | null
          price?: number | null
          product?: string | null
          quantity?: number | null
          rider_name?: string | null
          rider_phone?: string | null
          status?: string | null
          steadfast_consignment_id?: string | null
          steadfast_send_failed?: boolean | null
          tl_id?: string | null
          warehouse_sent_at?: string | null
          warehouse_sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cs_id_fkey"
            columns: ["cs_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cso_id_fkey"
            columns: ["cso_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tl_id_fkey"
            columns: ["tl_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_warehouse_sent_by_fkey"
            columns: ["warehouse_sent_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_orders: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          note: string | null
          scheduled_date: string | null
          status: string | null
          tl_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          note?: string | null
          scheduled_date?: string | null
          status?: string | null
          tl_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          note?: string | null
          scheduled_date?: string | null
          status?: string | null
          tl_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_orders_tl_id_fkey"
            columns: ["tl_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_share_config: {
        Row: {
          approved_by: string | null
          created_by: string | null
          id: string
          percentage: number
          role: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          created_by?: string | null
          id?: string
          percentage: number
          role: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          created_by?: string | null
          id?: string
          percentage?: number
          role?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profit_share_config_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_share_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sa_approvals: {
        Row: {
          created_at: string | null
          decided_by: string | null
          details: Json | null
          id: string
          rejection_reason: string | null
          requested_by: string | null
          status: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          decided_by?: string | null
          details?: Json | null
          id?: string
          rejection_reason?: string | null
          requested_by?: string | null
          status?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          decided_by?: string | null
          details?: Json | null
          id?: string
          rejection_reason?: string | null
          requested_by?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sa_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sa_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          panel: Database["public"]["Enums"]["app_panel"]
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          panel: Database["public"]["Enums"]["app_panel"]
          role: string
          user_id: string
        }
        Update: {
          id?: string
          panel?: Database["public"]["Enums"]["app_panel"]
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          basic_salary: number | null
          created_at: string | null
          department: string | null
          designation: string | null
          email: string
          father_name: string | null
          father_phone: string | null
          gps_location: string | null
          guardian_type: string | null
          id: string
          is_active: boolean | null
          mother_name: string | null
          mother_phone: string | null
          must_change_password: boolean | null
          name: string
          notification_volume: number | null
          off_days: string[] | null
          panel: Database["public"]["Enums"]["app_panel"]
          phone: string | null
          preferred_language: string | null
          role: string
          shift_end: string | null
          shift_start: string | null
          updated_at: string | null
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          basic_salary?: number | null
          created_at?: string | null
          department?: string | null
          designation?: string | null
          email: string
          father_name?: string | null
          father_phone?: string | null
          gps_location?: string | null
          guardian_type?: string | null
          id?: string
          is_active?: boolean | null
          mother_name?: string | null
          mother_phone?: string | null
          must_change_password?: boolean | null
          name: string
          notification_volume?: number | null
          off_days?: string[] | null
          panel: Database["public"]["Enums"]["app_panel"]
          phone?: string | null
          preferred_language?: string | null
          role: string
          shift_end?: string | null
          shift_start?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          basic_salary?: number | null
          created_at?: string | null
          department?: string | null
          designation?: string | null
          email?: string
          father_name?: string | null
          father_phone?: string | null
          gps_location?: string | null
          guardian_type?: string | null
          id?: string
          is_active?: boolean | null
          mother_name?: string | null
          mother_phone?: string | null
          must_change_password?: boolean | null
          name?: string
          notification_volume?: number | null
          off_days?: string[] | null
          panel?: Database["public"]["Enums"]["app_panel"]
          phone?: string | null
          preferred_language?: string | null
          role?: string
          shift_end?: string | null
          shift_start?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_salary: {
        Args: { _month: number; _user_id: string; _year: number }
        Returns: Json
      }
      get_atl_tl_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_id: { Args: { _auth_id: string }; Returns: string }
      get_user_panel: {
        Args: { _auth_id: string }
        Returns: Database["public"]["Enums"]["app_panel"]
      }
      has_panel: {
        Args: {
          _auth_id: string
          _panel: Database["public"]["Enums"]["app_panel"]
        }
        Returns: boolean
      }
      is_atl: { Args: { _auth_id: string }; Returns: boolean }
      is_bdo: { Args: { _auth_id: string }; Returns: boolean }
      is_group_member_of_leader: {
        Args: { _agent_id: string; _leader_id: string }
        Returns: boolean
      }
      is_hr: { Args: { _auth_id: string }; Returns: boolean }
      is_sa: { Args: { _auth_id: string }; Returns: boolean }
      notify_panel: {
        Args: {
          _message: string
          _panel: Database["public"]["Enums"]["app_panel"]
          _title: string
          _type?: string
        }
        Returns: undefined
      }
      notify_role: {
        Args: {
          _message: string
          _role: string
          _title: string
          _type?: string
        }
        Returns: undefined
      }
      notify_user: {
        Args: {
          _message: string
          _title: string
          _type?: string
          _user_id: string
        }
        Returns: undefined
      }
      progress_lead_after_cs: {
        Args: { _order_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_panel: "sa" | "hr" | "tl" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_panel: ["sa", "hr", "tl", "employee"],
    },
  },
} as const
