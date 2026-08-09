import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMentions() {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchSuggestions = async (query: string) => {
        if (!query || query.length < 1) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, username, display_name, avatar_url")
                .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
                .limit(5);

            if (error) throw error;
            setSuggestions(data || []);
        } catch (err) {
            console.error("Error fetching mention suggestions:", err);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    };

    return { suggestions, loading, fetchSuggestions, clearSuggestions: () => setSuggestions([]) };
}
