// Supabase configuration
const supabaseUrl = 'https://qzpgnhnjllhljkmklttm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cGduaG5qbGxobGprbWtsdHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMjA4ODAsImV4cCI6MjA3MjY5Njg4MH0.1kSi6spn6sbpYgsO2-b0-vb_nBqELc-bfyb5vm-9hDQ';
let supabase;

// Initialize Supabase with error handling
try {
    supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
} catch (error) {
    console.warn('Supabase initialization failed, using local storage fallback');
    supabase = null;
}
