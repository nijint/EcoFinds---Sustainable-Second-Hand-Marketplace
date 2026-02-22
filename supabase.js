// Supabase configuration
const supabaseUrl = 'YOUR SUPABASE URL';
const supabaseKey = 'YOUR SUPABASE KEY';
let supabase;

// Initialize Supabase with error handling
try {
    supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
} catch (error) {
    console.warn('Supabase initialization failed, using local storage fallback');
    supabase = null;
}

