export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      blood_pressure_readings: {
        Row: {
          id: string;
          user_id: string;
          systolic: number;
          diastolic: number;
          pulse: number;
          note: string | null;
          measured_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          systolic: number;
          diastolic: number;
          pulse: number;
          note?: string | null;
          measured_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          systolic?: number;
          diastolic?: number;
          pulse?: number;
          note?: string | null;
          measured_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blood_pressure_readings_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
