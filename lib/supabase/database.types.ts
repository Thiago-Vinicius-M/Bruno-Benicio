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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agenda_settings: {
        Row: {
          id: boolean
          public_days: number
          public_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          public_days?: number
          public_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          public_days?: number
          public_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          can_customize_link_prices: boolean
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          id: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_customize_link_prices?: boolean
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          id: string
          name: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_customize_link_prices?: boolean
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_link_prices: {
        Row: {
          default_price: number | null
          link_id: string
          model_id: string
          price: number
        }
        Insert: {
          default_price?: number | null
          link_id: string
          model_id: string
          price: number
        }
        Update: {
          default_price?: number | null
          link_id?: string
          model_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "seller_link_prices_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "seller_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_link_prices_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "show_models"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_links: {
        Row: {
          active: boolean
          channel_id: string
          channel_label: string
          code: string
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          expires_at: string
          id: string
          label: string | null
          whatsapp: string
        }
        Insert: {
          active?: boolean
          channel_id: string
          channel_label: string
          code?: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          expires_at: string
          id?: string
          label?: string | null
          whatsapp: string
        }
        Update: {
          active?: boolean
          channel_id?: string
          channel_label?: string
          code?: string
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          expires_at?: string
          id?: string
          label?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_links_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_links_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      show_financial_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          show_id: string
          type: Database["public"]["Enums"]["financial_entry_type"]
          updated_at: string
          updated_by: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          show_id: string
          type: Database["public"]["Enums"]["financial_entry_type"]
          updated_at?: string
          updated_by?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          show_id?: string
          type?: Database["public"]["Enums"]["financial_entry_type"]
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_financial_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_financial_entries_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_financial_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      show_models: {
        Row: {
          active: boolean
          corporate_price: number
          created_at: string
          created_by: string | null
          description: string | null
          duration: string
          id: string
          name: string
          position: number
          price: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          corporate_price: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration: string
          id?: string
          name: string
          position?: number
          price: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          corporate_price?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: string
          id?: string
          name?: string
          position?: number
          price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "show_models_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_models_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          show_date: string
          show_time: string
          updated_at: string
          updated_by: string
          venue_instagram: string | null
          venue_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          show_date: string
          show_time: string
          updated_at?: string
          updated_by?: string
          venue_instagram?: string | null
          venue_name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          show_date?: string
          show_time?: string
          updated_at?: string
          updated_by?: string
          venue_instagram?: string | null
          venue_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "shows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_settings: {
        Row: {
          home_limit_desktop: number
          home_limit_mobile: number
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          home_limit_desktop?: number
          home_limit_mobile?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          home_limit_desktop?: number
          home_limit_mobile?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          orientation: Database["public"]["Enums"]["video_orientation"]
          placement: Database["public"]["Enums"]["video_placement"]
          position: number
          poster: string | null
          source: string
          source_type: Database["public"]["Enums"]["video_source"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          orientation: Database["public"]["Enums"]["video_orientation"]
          placement?: Database["public"]["Enums"]["video_placement"]
          position?: number
          poster?: string | null
          source: string
          source_type: Database["public"]["Enums"]["video_source"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          orientation?: Database["public"]["Enums"]["video_orientation"]
          placement?: Database["public"]["Enums"]["video_placement"]
          position?: number
          poster?: string | null
          source?: string
          source_type?: Database["public"]["Enums"]["video_source"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_channels: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          label: string
          owner_id: string
          redirect_channel_id: string | null
          updated_at: string
          updated_by: string | null
          whatsapp: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          label: string
          owner_id: string
          redirect_channel_id?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          label?: string
          owner_id?: string
          redirect_channel_id?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_channels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_channels_redirect_channel_id_fkey"
            columns: ["redirect_channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_channels_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_commercial_link: {
        Args: {
          p_channel_id: string
          p_expires_at: string
          p_items: Json
          p_label: string
          p_validity: string
        }
        Returns: {
          code: string
          expires_at: string
          id: string
        }[]
      }
      deactivate_seller_link: { Args: { p_id: string }; Returns: undefined }
      get_commercial_link_permissions: {
        Args: never
        Returns: {
          can_create: boolean
          can_customize_prices: boolean
        }[]
      }
      get_commercial_show_models: {
        Args: { p_code: string }
        Returns: {
          description: string
          duration: string
          id: string
          name: string
          price: number
        }[]
      }
      get_financial_report: {
        Args: { p_from: string; p_group_by?: string; p_to: string }
        Returns: {
          cache_total: number
          entry_count: number
          expense_total: number
          net_total: number
          other_revenue_total: number
          period_start: string
          show_count: number
        }[]
      }
      get_link_show_models: {
        Args: never
        Returns: {
          corporate_price: number
          id: string
          name: string
          price: number
        }[]
      }
      get_public_agenda: {
        Args: { p_from: string; p_to: string }
        Returns: {
          id: string
          show_date: string
          show_time: string
          venue_instagram: string
          venue_name: string
        }[]
      }
      get_public_agenda_settings: {
        Args: never
        Returns: {
          public_days: number
          public_enabled: boolean
        }[]
      }
      get_public_show_models: {
        Args: never
        Returns: {
          description: string
          duration: string
          id: string
          name: string
        }[]
      }
      get_public_video_settings: {
        Args: never
        Returns: {
          home_limit_desktop: number
          home_limit_mobile: number
        }[]
      }
      get_public_videos: {
        Args: never
        Returns: {
          id: string
          orientation: Database["public"]["Enums"]["video_orientation"]
          placement: Database["public"]["Enums"]["video_placement"]
          poster: string
          source: string
          source_type: Database["public"]["Enums"]["video_source"]
          title: string
        }[]
      }
      get_seller_link: {
        Args: { p_code: string }
        Returns: {
          active: boolean
          expires_at: string
          link_kind: string
          status: string
          whatsapp: string
        }[]
      }
      get_seller_links: {
        Args: never
        Returns: {
          channel_id: string
          channel_label: string
          code: string
          created_at: string
          created_by: string
          created_by_name: string
          deactivated_at: string
          destination: string
          expires_at: string
          id: string
          label: string
          prices: Json
          status: string
          whatsapp: string
        }[]
      }
      get_team_names: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      get_whatsapp_channel_owners: {
        Args: never
        Returns: {
          id: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      move_show_model: {
        Args: { p_direction: string; p_id: string }
        Returns: undefined
      }
      move_video: {
        Args: { p_direction: string; p_id: string }
        Returns: undefined
      }
      set_main_video: { Args: { p_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "ADMIN" | "EDITOR" | "SELLER"
      financial_entry_type: "CACHE" | "OTHER_REVENUE" | "EXPENSE"
      video_orientation: "landscape" | "portrait"
      video_placement: "main" | "secondary" | "gallery"
      video_source: "youtube" | "local"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["ADMIN", "EDITOR", "SELLER"],
      financial_entry_type: ["CACHE", "OTHER_REVENUE", "EXPENSE"],
      video_orientation: ["landscape", "portrait"],
      video_placement: ["main", "secondary", "gallery"],
      video_source: ["youtube", "local"],
    },
  },
} as const
