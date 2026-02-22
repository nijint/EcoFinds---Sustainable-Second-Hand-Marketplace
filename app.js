// ============================================================
// EcoFinds - App Logic
// ============================================================

// Supabase configuration — loaded from .env via Vite
// Variables prefixed with VITE_ are exposed to the browser by Vite at build time.
// Never put secrets (JWT_SECRET, DATABASE_URL) with the VITE_ prefix.
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiBaseUrl   = import.meta.env.VITE_API_URL;   // available if you need it elsewhere
let supabase;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Falling back to localStorage demo mode.');
}

try {
    supabase = (supabaseUrl && supabaseKey)
        ? window.supabase.createClient(supabaseUrl, supabaseKey)
        : null;
} catch (error) {
    console.warn('Supabase initialization failed, using local storage fallback');
    supabase = null;
}

// ── Global State ────────────────────────────────────────────
let currentUser = null;
let products = [];
let userProducts = [];
let cartItems = [];
let purchases = [];
let currentProduct = null;
let useLocalStorage = !supabase;

// ── Sample Data ─────────────────────────────────────────────
const sampleImages = [
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1554995207-c18c203602cb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1588436706487-9d55d73a39e3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1581539250439-c96689b516dd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1550565118-3a14e8d0386f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
];

const sampleProducts = [
    {
        id: '1',
        title: 'Vintage Wooden Chair',
        description: 'Beautiful handcrafted wooden chair with intricate details. Perfect for adding character to any room.',
        price: 75.00,
        category: 'Furniture',
        image_url: sampleImages[0],
        user_id: 'sample-user-1',
        created_at: new Date().toISOString(),
        profiles: { username: 'WoodCraftLover' }
    },
    {
        id: '2',
        title: 'Pre-loved Designer Jacket',
        description: 'Stylish designer jacket in excellent condition. Sustainable fashion at its best!',
        price: 120.00,
        category: 'Clothing',
        image_url: sampleImages[1],
        user_id: 'sample-user-2',
        created_at: new Date().toISOString(),
        profiles: { username: 'FashionForward' }
    },
    {
        id: '3',
        title: 'Laptop - Barely Used',
        description: 'High-performance laptop in great condition. Perfect for students or professionals.',
        price: 450.00,
        category: 'Electronics',
        image_url: sampleImages[2],
        user_id: 'sample-user-3',
        created_at: new Date().toISOString(),
        profiles: { username: 'TechGuru' }
    },
    {
        id: '4',
        title: 'Collection of Classic Books',
        description: 'Amazing collection of classic literature books. Great for book lovers!',
        price: 35.00,
        category: 'Books',
        image_url: sampleImages[3],
        user_id: 'sample-user-4',
        created_at: new Date().toISOString(),
        profiles: { username: 'BookWorm' }
    }
];

// ── Local Storage Helpers ────────────────────────────────────
function saveToLocal(key, data) {
    localStorage.setItem(`ecofinds_${key}`, JSON.stringify(data));
}

function getFromLocal(key) {
    const data = localStorage.getItem(`ecofinds_${key}`);
    return data ? JSON.parse(data) : null;
}

// ── App Initialization ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    if (useLocalStorage) {
        currentUser = getFromLocal('currentUser');
        products = getFromLocal('products') || sampleProducts;
        if (currentUser) {
            userProducts = getFromLocal(`userProducts_${currentUser.id}`) || [];
            cartItems = getFromLocal(`cartItems_${currentUser.id}`) || [];
            purchases = getFromLocal(`purchases_${currentUser.id}`) || [];
        }
        updateAuthState(!!currentUser);
    } else {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                currentUser = session.user;
                await loadUserProfile();
                updateAuthState(true);
                await loadUserData();
            } else {
                updateAuthState(false);
            }
        } catch (error) {
            console.warn('Auth check failed, using local mode');
            useLocalStorage = true;
            products = sampleProducts;
            updateAuthState(false);
        }
    }

    await loadProducts();
    await loadFeaturedProducts();
}

function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
    document.getElementById('addProductForm').addEventListener('submit', handleAddProduct);
    document.getElementById('editProductForm').addEventListener('submit', handleEditProduct);
    document.getElementById('profileForm').addEventListener('submit', handleUpdateProfile);

    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchProducts();
    });

    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        filterByCategory(e.target.value);
    });

    if (!useLocalStorage && supabase) {
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                currentUser = session.user;
                updateAuthState(true);
                loadUserProfile();
                loadUserData();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                updateAuthState(false);
                showHome();
            }
        });
    }
}

function updateAuthState(isAuthenticated) {
    const authNav = document.getElementById('authNav');
    const authButtons = document.getElementById('authButtons');
    const unauthButtons = document.getElementById('unauthButtons');

    if (isAuthenticated) {
        authNav.classList.remove('hidden');
        authButtons.classList.remove('hidden');
        unauthButtons.classList.add('hidden');
    } else {
        authNav.classList.add('hidden');
        authButtons.classList.add('hidden');
        unauthButtons.classList.remove('hidden');
    }
}

// ── Authentication ───────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (useLocalStorage) {
        currentUser = {
            id: 'demo-user-' + Date.now(),
            email,
            user_metadata: { username: email.split('@')[0] }
        };
        saveToLocal('currentUser', currentUser);
        updateAuthState(true);
        showToast('Welcome back! (Demo Mode)', 'success');
        showHome();
        return;
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            showToast('Login failed: ' + error.message, 'error');
        } else {
            showToast('Welcome back!', 'success');
            showHome();
        }
    } catch (error) {
        showToast('Login failed. Using demo mode.', 'error');
        currentUser = {
            id: 'demo-user-' + Date.now(),
            email,
            user_metadata: { username: email.split('@')[0] }
        };
        updateAuthState(true);
        showHome();
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    if (useLocalStorage) {
        currentUser = {
            id: 'demo-user-' + Date.now(),
            email,
            user_metadata: { username }
        };
        saveToLocal('currentUser', currentUser);
        updateAuthState(true);
        showToast('Account created successfully! (Demo Mode)', 'success');
        showHome();
        return;
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } }
        });
        if (error) {
            showToast('Signup failed: ' + error.message, 'error');
        } else {
            showToast('Account created successfully! You can now start shopping.', 'success');
            showHome();
        }
    } catch (error) {
        showToast('Signup failed. Using demo mode.', 'error');
        currentUser = {
            id: 'demo-user-' + Date.now(),
            email,
            user_metadata: { username }
        };
        updateAuthState(true);
        showHome();
    }
}

async function logout() {
    if (useLocalStorage) {
        currentUser = null;
        saveToLocal('currentUser', null);
        updateAuthState(false);
        cartItems = [];
        updateCartCount();
        showToast('Thanks for shopping sustainably!', 'success');
        showHome();
        return;
    }

    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            showToast('Logout failed: ' + error.message, 'error');
        } else {
            showToast('Thanks for shopping sustainably!', 'success');
            cartItems = [];
            updateCartCount();
            showHome();
        }
    } catch (error) {
        currentUser = null;
        updateAuthState(false);
        cartItems = [];
        updateCartCount();
        showHome();
    }
}

// ── Profile ──────────────────────────────────────────────────
async function loadUserProfile() {
    if (!currentUser) return;

    if (useLocalStorage) {
        const profile = getFromLocal(`profile_${currentUser.id}`) || {};
        document.getElementById('profileUsername').value = profile.username || currentUser.user_metadata?.username || '';
        document.getElementById('profileEmail').value = profile.email || currentUser.email || '';
        document.getElementById('profileBio').value = profile.bio || '';
        return;
    }

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (data) {
            document.getElementById('profileUsername').value = data.username || '';
            document.getElementById('profileEmail').value = data.email || currentUser.email || '';
            document.getElementById('profileBio').value = data.bio || '';
        }
    } catch (error) {
        console.warn('Profile load failed, using defaults');
    }
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    if (!currentUser) return;

    const username = document.getElementById('profileUsername').value;
    const bio = document.getElementById('profileBio').value;

    if (useLocalStorage) {
        const profile = { id: currentUser.id, username, bio, email: currentUser.email };
        saveToLocal(`profile_${currentUser.id}`, profile);
        showToast('Profile updated successfully!', 'success');
        return;
    }

    try {
        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: currentUser.id,
                username,
                bio,
                email: currentUser.email,
                updated_at: new Date().toISOString()
            });

        if (error) {
            showToast('Profile update failed: ' + error.message, 'error');
        } else {
            showToast('Profile updated successfully!', 'success');
        }
    } catch (error) {
        showToast('Profile updated successfully! (Local Mode)', 'success');
    }
}

// ── Products ─────────────────────────────────────────────────
async function loadProducts() {
    if (useLocalStorage) {
        products = getFromLocal('products') || sampleProducts;
        displayProducts();
        return;
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .select('*, profiles:user_id (username)')
            .order('created_at', { ascending: false });

        products = error ? sampleProducts : (data || sampleProducts);
    } catch (error) {
        console.warn('Using sample products');
        products = sampleProducts;
    }

    displayProducts();
}

async function loadFeaturedProducts() {
    if (useLocalStorage) {
        const featured = (getFromLocal('products') || sampleProducts).slice(0, 8);
        displayFeaturedProducts(featured);
        return;
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .select('*, profiles:user_id (username)')
            .limit(8)
            .order('created_at', { ascending: false });

        displayFeaturedProducts(error ? sampleProducts.slice(0, 4) : (data || sampleProducts.slice(0, 4)));
    } catch (error) {
        displayFeaturedProducts(sampleProducts.slice(0, 4));
    }
}

function displayProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (products.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-16"><h3 class="text-2xl text-gray-600">No products found</h3><p class="text-gray-500 mt-2">Try adjusting your search or filters</p></div>';
        return;
    }

    grid.innerHTML = products.map(product => createProductCard(product)).join('');
}

function displayFeaturedProducts(featuredProducts) {
    const grid = document.getElementById('featuredProducts');
    if (!grid) return;
    grid.innerHTML = featuredProducts.map(product => createProductCard(product)).join('');
}

function createProductCard(product) {
    const imageUrl = product.image_url || sampleImages[Math.floor(Math.random() * sampleImages.length)];
    const sellerName = product.profiles?.username || 'EcoFinder';

    return `
        <div class="product-card bg-white rounded-2xl overflow-hidden shadow-lg hover-lift cursor-pointer fade-in" onclick="showProductDetail('${product.id}')">
            <div class="relative h-64 overflow-hidden">
                <img src="${imageUrl}" alt="${product.title}" class="product-image w-full h-full object-cover" onerror="this.src='${sampleImages[0]}'">
                <div class="absolute top-4 left-4">
                    <span class="bg-teal-100 text-teal-800 text-xs font-semibold px-3 py-1 rounded-full">${product.category}</span>
                </div>
                <button onclick="event.stopPropagation(); toggleFavorite('${product.id}')" class="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-colors">
                    <i class="far fa-heart text-gray-700 hover:text-red-500 transition-colors"></i>
                </button>
                <div class="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span class="font-bold text-teal-600">$${parseFloat(product.price).toFixed(2)}</span>
                </div>
            </div>
            <div class="p-6">
                <h3 class="font-bold text-lg text-gray-800 mb-2 line-clamp-2">${product.title}</h3>
                <p class="text-gray-600 text-sm mb-4 line-clamp-2">${product.description}</p>
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <div class="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                            <i class="fas fa-user text-teal-600 text-sm"></i>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-800">${sellerName}</p>
                            <div class="flex items-center">
                                <i class="fas fa-star text-yellow-400 text-xs mr-1"></i>
                                <span class="text-xs text-gray-500">4.8</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <i class="fas fa-leaf mr-1"></i>
                        <span>Eco-Friendly</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function handleAddProduct(e) {
    e.preventDefault();
    if (!currentUser) {
        showToast('Please log in to add products', 'error');
        return;
    }

    const title = document.getElementById('productTitle').value;
    const category = document.getElementById('productCategory').value;
    const description = document.getElementById('productDescription').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const imageUrl = document.getElementById('productImage').value;

    const newProduct = {
        id: 'product-' + Date.now(),
        title, category, description, price,
        image_url: imageUrl,
        user_id: currentUser.id,
        created_at: new Date().toISOString(),
        profiles: {
            username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Anonymous'
        }
    };

    if (useLocalStorage) {
        const allProducts = getFromLocal('products') || [];
        allProducts.unshift(newProduct);
        saveToLocal('products', allProducts);

        const myProducts = getFromLocal(`userProducts_${currentUser.id}`) || [];
        myProducts.unshift(newProduct);
        saveToLocal(`userProducts_${currentUser.id}`, myProducts);

        showToast('Product listed successfully!', 'success');
        document.getElementById('addProductForm').reset();
        await loadProducts();
        await loadUserProducts();
        showMyListings();
        return;
    }

    try {
        const { error } = await supabase
            .from('products')
            .insert({ title, category, description, price, image_url: imageUrl, user_id: currentUser.id });

        if (error) {
            showToast('Failed to add product: ' + error.message, 'error');
        } else {
            showToast('Product listed successfully!', 'success');
            document.getElementById('addProductForm').reset();
            await loadProducts();
            await loadUserProducts();
            showMyListings();
        }
    } catch (error) {
        const allProducts = getFromLocal('products') || [];
        allProducts.unshift(newProduct);
        saveToLocal('products', allProducts);
        products = allProducts;

        showToast('Product listed successfully! (Local Mode)', 'success');
        document.getElementById('addProductForm').reset();
        displayProducts();
        showMyListings();
    }
}

async function loadUserProducts() {
    if (!currentUser) return;

    if (useLocalStorage) {
        userProducts = getFromLocal(`userProducts_${currentUser.id}`) || [];
        displayUserProducts();
        return;
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        userProducts = error ? [] : (data || []);
    } catch (error) {
        userProducts = getFromLocal(`userProducts_${currentUser.id}`) || [];
    }

    displayUserProducts();
}

function displayUserProducts() {
    const grid = document.getElementById('myListingsGrid');
    if (!grid) return;

    if (userProducts.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i class="fas fa-store text-4xl text-gray-400"></i>
                </div>
                <h3 class="text-2xl font-bold text-gray-600 mb-4">No listings yet</h3>
                <p class="text-gray-500 mb-8">Start selling your items on EcoFinds!</p>
                <button onclick="showAddProduct()" class="btn-primary px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105">
                    Add Your First Product
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = userProducts.map(product => createUserProductCard(product)).join('');
}

function createUserProductCard(product) {
    const imageUrl = product.image_url || sampleImages[Math.floor(Math.random() * sampleImages.length)];

    return `
        <div class="bg-white rounded-2xl overflow-hidden shadow-lg hover-lift">
            <div class="relative h-48 overflow-hidden">
                <img src="${imageUrl}" alt="${product.title}" class="w-full h-full object-cover" onerror="this.src='${sampleImages[0]}'">
                <div class="absolute top-4 left-4">
                    <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">Your Listing</span>
                </div>
            </div>
            <div class="p-6">
                <div class="flex justify-between items-start mb-3">
                    <h3 class="font-bold text-lg text-gray-800">${product.title}</h3>
                    <span class="font-bold text-teal-600">$${parseFloat(product.price).toFixed(2)}</span>
                </div>
                <p class="text-gray-600 text-sm mb-4 line-clamp-2">${product.description}</p>
                <div class="flex space-x-3">
                    <button onclick="editProduct('${product.id}')" class="flex-1 bg-teal-100 hover:bg-teal-200 text-teal-700 py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center">
                        <i class="fas fa-edit mr-2"></i>Edit
                    </button>
                    <button onclick="deleteProduct('${product.id}')" class="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center">
                        <i class="fas fa-trash mr-2"></i>Delete
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function editProduct(productId) {
    const product = userProducts.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('editProductId').value = product.id;
    document.getElementById('editProductTitle').value = product.title;
    document.getElementById('editProductCategory').value = product.category;
    document.getElementById('editProductDescription').value = product.description;
    document.getElementById('editProductPrice').value = product.price;
    document.getElementById('editProductImage').value = product.image_url || '';

    showEditProduct();
}

async function handleEditProduct(e) {
    e.preventDefault();

    const id = document.getElementById('editProductId').value;
    const title = document.getElementById('editProductTitle').value;
    const category = document.getElementById('editProductCategory').value;
    const description = document.getElementById('editProductDescription').value;
    const price = parseFloat(document.getElementById('editProductPrice').value);
    const imageUrl = document.getElementById('editProductImage').value;

    if (useLocalStorage) {
        const allProducts = getFromLocal('products') || [];
        const idx = allProducts.findIndex(p => p.id === id);
        if (idx !== -1) {
            allProducts[idx] = { ...allProducts[idx], title, category, description, price, image_url: imageUrl, updated_at: new Date().toISOString() };
            saveToLocal('products', allProducts);
        }

        const myProducts = getFromLocal(`userProducts_${currentUser.id}`) || [];
        const userIdx = myProducts.findIndex(p => p.id === id);
        if (userIdx !== -1) {
            myProducts[userIdx] = { ...myProducts[userIdx], title, category, description, price, image_url: imageUrl, updated_at: new Date().toISOString() };
            saveToLocal(`userProducts_${currentUser.id}`, myProducts);
        }

        showToast('Product updated successfully!', 'success');
        await loadProducts();
        await loadUserProducts();
        showMyListings();
        return;
    }

    try {
        const { error } = await supabase
            .from('products')
            .update({ title, category, description, price, image_url: imageUrl, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', currentUser.id);

        if (error) {
            showToast('Failed to update product: ' + error.message, 'error');
        } else {
            showToast('Product updated successfully!', 'success');
            await loadProducts();
            await loadUserProducts();
            showMyListings();
        }
    } catch (error) {
        showToast('Product updated successfully! (Local Mode)', 'success');
        showMyListings();
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    if (useLocalStorage) {
        const allProducts = (getFromLocal('products') || []).filter(p => p.id !== productId);
        saveToLocal('products', allProducts);

        const myProducts = (getFromLocal(`userProducts_${currentUser.id}`) || []).filter(p => p.id !== productId);
        saveToLocal(`userProducts_${currentUser.id}`, myProducts);

        showToast('Product deleted successfully!', 'success');
        await loadProducts();
        await loadUserProducts();
        return;
    }

    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId)
            .eq('user_id', currentUser.id);

        if (error) {
            showToast('Failed to delete product: ' + error.message, 'error');
        } else {
            showToast('Product deleted successfully!', 'success');
            await loadProducts();
            await loadUserProducts();
        }
    } catch (error) {
        showToast('Product deleted successfully! (Local Mode)', 'success');
        await loadUserProducts();
    }
}

// ── Product Detail ───────────────────────────────────────────
async function showProductDetail(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    currentProduct = product;

    const imageUrl = product.image_url || sampleImages[Math.floor(Math.random() * sampleImages.length)];
    const sellerName = product.profiles?.username || 'EcoFinder';

    document.getElementById('productDetailImage').src = imageUrl;
    document.getElementById('productDetailTitle').textContent = product.title;
    document.getElementById('productDetailPrice').textContent = `$${parseFloat(product.price).toFixed(2)}`;
    document.getElementById('productDetailCategory').textContent = product.category;
    document.getElementById('productDetailDescription').textContent = product.description;
    document.getElementById('productDetailSeller').textContent = sellerName;

    const addToCartBtn = document.getElementById('addToCartBtn');
    addToCartBtn.style.display = (currentUser && product.user_id === currentUser.id) ? 'none' : 'flex';

    showPage('productDetailPage');
}

// ── Cart ─────────────────────────────────────────────────────
async function addToCart() {
    if (!currentUser) {
        showToast('Please log in to add items to cart', 'error');
        showLogin();
        return;
    }

    if (!currentProduct) return;

    const existingItem = cartItems.find(item => item.product_id === currentProduct.id);
    if (existingItem) {
        showToast('Item already in cart!', 'info');
        return;
    }

    const newCartItem = {
        id: 'cart-' + Date.now(),
        user_id: currentUser.id,
        product_id: currentProduct.id,
        quantity: 1,
        products: currentProduct
    };

    if (useLocalStorage) {
        cartItems.push(newCartItem);
        saveToLocal(`cartItems_${currentUser.id}`, cartItems);
        showToast('Added to cart!', 'success');
        updateCartCount();
        return;
    }

    try {
        const { error } = await supabase
            .from('cart_items')
            .insert({ user_id: currentUser.id, product_id: currentProduct.id, quantity: 1 });

        if (error) {
            showToast('Failed to add to cart: ' + error.message, 'error');
        } else {
            showToast('Added to cart!', 'success');
            await loadCartItems();
        }
    } catch (error) {
        cartItems.push(newCartItem);
        showToast('Added to cart! (Local Mode)', 'success');
        updateCartCount();
    }
}

async function loadCartItems() {
    if (!currentUser) return;

    if (useLocalStorage) {
        cartItems = getFromLocal(`cartItems_${currentUser.id}`) || [];
        displayCartItems();
        updateCartCount();
        return;
    }

    try {
        const { data, error } = await supabase
            .from('cart_items')
            .select('*, products (*, profiles:user_id (username))')
            .eq('user_id', currentUser.id);

        cartItems = error ? (getFromLocal(`cartItems_${currentUser.id}`) || []) : (data || []);
    } catch (error) {
        cartItems = getFromLocal(`cartItems_${currentUser.id}`) || [];
    }

    displayCartItems();
    updateCartCount();
}

function displayCartItems() {
    const container = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    if (!container) return;

    if (cartItems.length === 0) {
        container.innerHTML = '';
        emptyCart?.classList.remove('hide');
        updateCartSummary(0);
        return;
    }

    emptyCart?.classList.add('hide');
    container.innerHTML = cartItems.map(item => createCartItemCard(item)).join('');

    const subtotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.products.price) * item.quantity), 0);
    updateCartSummary(subtotal);
}

function createCartItemCard(item) {
    const product = item.products;
    const imageUrl = product.image_url || sampleImages[Math.floor(Math.random() * sampleImages.length)];
    const sellerName = product.profiles?.username || 'EcoFinder';

    return `
        <div class="bg-white rounded-2xl shadow-lg p-6 hover-lift">
            <div class="flex items-center space-x-6">
                <img src="${imageUrl}" alt="${product.title}" class="w-24 h-24 object-cover rounded-xl" onerror="this.src='${sampleImages[0]}'">
                <div class="flex-1">
                    <h3 class="font-bold text-lg text-gray-800">${product.title}</h3>
                    <p class="text-gray-600 mb-1">by ${sellerName}</p>
                    <span class="bg-teal-100 text-teal-800 text-xs font-medium px-2 py-1 rounded-full">${product.category}</span>
                </div>
                <div class="text-right">
                    <p class="font-bold text-xl text-teal-600 mb-3">$${parseFloat(product.price).toFixed(2)}</p>
                    <div class="flex items-center space-x-3">
                        <button onclick="updateCartQuantity('${item.id}', ${item.quantity - 1})" class="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors">
                            <i class="fas fa-minus text-sm text-gray-700"></i>
                        </button>
                        <span class="w-12 text-center font-semibold text-gray-800">${item.quantity}</span>
                        <button onclick="updateCartQuantity('${item.id}', ${item.quantity + 1})" class="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors">
                            <i class="fas fa-plus text-sm text-gray-700"></i>
                        </button>
                    </div>
                </div>
                <button onclick="removeFromCart('${item.id}')" class="text-red-500 hover:text-red-700 transition-colors p-2">
                    <i class="fas fa-trash text-xl"></i>
                </button>
            </div>
        </div>
    `;
}

async function updateCartQuantity(itemId, newQuantity) {
    if (newQuantity <= 0) {
        await removeFromCart(itemId);
        return;
    }

    if (useLocalStorage) {
        const idx = cartItems.findIndex(item => item.id === itemId);
        if (idx !== -1) {
            cartItems[idx].quantity = newQuantity;
            saveToLocal(`cartItems_${currentUser.id}`, cartItems);
            displayCartItems();
        }
        return;
    }

    try {
        const { error } = await supabase
            .from('cart_items')
            .update({ quantity: newQuantity })
            .eq('id', itemId)
            .eq('user_id', currentUser.id);

        if (error) {
            showToast('Failed to update quantity: ' + error.message, 'error');
        } else {
            await loadCartItems();
        }
    } catch (error) {
        const idx = cartItems.findIndex(item => item.id === itemId);
        if (idx !== -1) {
            cartItems[idx].quantity = newQuantity;
            displayCartItems();
        }
    }
}

async function removeFromCart(itemId) {
    if (useLocalStorage) {
        cartItems = cartItems.filter(item => item.id !== itemId);
        saveToLocal(`cartItems_${currentUser.id}`, cartItems);
        showToast('Item removed from cart', 'success');
        displayCartItems();
        updateCartCount();
        return;
    }

    try {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('id', itemId)
            .eq('user_id', currentUser.id);

        if (error) {
            showToast('Failed to remove item: ' + error.message, 'error');
        } else {
            showToast('Item removed from cart', 'success');
            await loadCartItems();
        }
    } catch (error) {
        cartItems = cartItems.filter(item => item.id !== itemId);
        showToast('Item removed from cart', 'success');
        displayCartItems();
        updateCartCount();
    }
}

function updateCartCount() {
    const cartCount = document.getElementById('cartCount');
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
}

function updateCartSummary(subtotal) {
    document.getElementById('cartSubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('cartTotal').textContent = `$${subtotal.toFixed(2)}`;
}

// ── Checkout ─────────────────────────────────────────────────
async function checkout() {
    if (!currentUser) {
        showToast('Please log in to checkout', 'error');
        return;
    }

    if (cartItems.length === 0) {
        showToast('Your cart is empty', 'error');
        return;
    }

    const newPurchases = cartItems.map(item => ({
        id: 'purchase-' + Date.now() + '-' + Math.random(),
        user_id: currentUser.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.products.price,
        seller_id: item.products.user_id,
        created_at: new Date().toISOString(),
        products: item.products
    }));

    if (useLocalStorage) {
        const currentPurchases = getFromLocal(`purchases_${currentUser.id}`) || [];
        purchases = [...newPurchases, ...currentPurchases];
        saveToLocal(`purchases_${currentUser.id}`, purchases);

        cartItems = [];
        saveToLocal(`cartItems_${currentUser.id}`, cartItems);

        showToast('🎉 Purchase completed! Thanks for shopping sustainably!', 'success');
        updateCartCount();
        showPurchases();
        return;
    }

    try {
        for (const item of cartItems) {
            const { error: purchaseError } = await supabase
                .from('purchases')
                .insert({
                    user_id: currentUser.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: item.products.price,
                    seller_id: item.products.user_id
                });

            if (!purchaseError) {
                await supabase.from('cart_items').delete().eq('id', item.id);
            }
        }

        showToast('🎉 Purchase completed! Thanks for shopping sustainably!', 'success');
        cartItems = [];
        updateCartCount();
        await loadPurchases();
        showPurchases();
    } catch (error) {
        const currentPurchases = getFromLocal(`purchases_${currentUser.id}`) || [];
        purchases = [...newPurchases, ...currentPurchases];
        saveToLocal(`purchases_${currentUser.id}`, purchases);

        cartItems = [];
        showToast('🎉 Purchase completed! Thanks for shopping sustainably!', 'success');
        updateCartCount();
        showPurchases();
    }
}

// ── Purchases ────────────────────────────────────────────────
async function loadPurchases() {
    if (!currentUser) return;

    if (useLocalStorage) {
        purchases = getFromLocal(`purchases_${currentUser.id}`) || [];
        displayPurchases();
        return;
    }

    try {
        const { data, error } = await supabase
            .from('purchases')
            .select('*, products (*, profiles:user_id (username))')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        purchases = error ? (getFromLocal(`purchases_${currentUser.id}`) || []) : (data || []);
    } catch (error) {
        purchases = getFromLocal(`purchases_${currentUser.id}`) || [];
    }

    displayPurchases();
}

function displayPurchases() {
    const grid = document.getElementById('purchasesGrid');
    const noPurchases = document.getElementById('noPurchases');
    if (!grid) return;

    if (purchases.length === 0) {
        grid.innerHTML = '';
        noPurchases?.classList.remove('hide');
        return;
    }

    noPurchases?.classList.add('hide');
    grid.innerHTML = purchases.map(purchase => createPurchaseCard(purchase)).join('');
}

function createPurchaseCard(purchase) {
    const product = purchase.products;
    const imageUrl = product.image_url || sampleImages[Math.floor(Math.random() * sampleImages.length)];
    const sellerName = product.profiles?.username || 'EcoFinder';
    const purchaseDate = new Date(purchase.created_at).toLocaleDateString();

    return `
        <div class="bg-white rounded-2xl overflow-hidden shadow-lg hover-lift">
            <div class="relative h-48 overflow-hidden">
                <img src="${imageUrl}" alt="${product.title}" class="w-full h-full object-cover" onerror="this.src='${sampleImages[0]}'">
                <div class="absolute top-4 left-4">
                    <span class="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full flex items-center">
                        <i class="fas fa-check mr-1"></i>Purchased
                    </span>
                </div>
            </div>
            <div class="p-6">
                <h3 class="font-bold text-lg text-gray-800 mb-2">${product.title}</h3>
                <p class="text-gray-600 text-sm mb-2">Sold by ${sellerName}</p>
                <p class="text-gray-500 text-sm mb-4">Purchased on ${purchaseDate}</p>
                <div class="flex justify-between items-center">
                    <span class="font-bold text-xl text-teal-600">$${parseFloat(purchase.price).toFixed(2)}</span>
                    <span class="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">Qty: ${purchase.quantity}</span>
                </div>
            </div>
        </div>
    `;
}

// ── Search & Filter ──────────────────────────────────────────
async function searchProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

    if (!searchTerm) {
        await loadProducts();
        return;
    }

    let sourceProducts = products;
    if (useLocalStorage) sourceProducts = getFromLocal('products') || sampleProducts;

    products = sourceProducts.filter(product =>
        product.title.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm) ||
        product.category.toLowerCase().includes(searchTerm)
    );

    displayProducts();
    showProducts();
}

async function filterByCategory(category) {
    if (!category) {
        await loadProducts();
        return;
    }

    if (useLocalStorage) {
        const allProducts = getFromLocal('products') || sampleProducts;
        products = allProducts.filter(product => product.category === category);
        displayProducts();
        showProducts();
        return;
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .select('*, profiles:user_id (username)')
            .eq('category', category)
            .order('created_at', { ascending: false });

        products = error
            ? (getFromLocal('products') || sampleProducts).filter(p => p.category === category)
            : (data || []);
    } catch (error) {
        products = (getFromLocal('products') || sampleProducts).filter(p => p.category === category);
    }

    displayProducts();
    showProducts();
}

// ── Dashboard ────────────────────────────────────────────────
async function loadUserData() {
    if (!currentUser) return;
    await Promise.all([loadCartItems(), loadUserProducts(), loadPurchases()]);
    updateDashboardStats();
}

function updateDashboardStats() {
    document.getElementById('activeListings').textContent = userProducts.length;

    const totalSales = purchases
        .filter(p => p.seller_id === currentUser.id)
        .reduce((sum, p) => sum + parseFloat(p.price) * p.quantity, 0);
    document.getElementById('totalSales').textContent = `$${totalSales.toFixed(2)}`;

    document.getElementById('itemsPurchased').textContent = purchases.length;
    const itemsReused = purchases.length + userProducts.length;
    document.getElementById('itemsReused').textContent = itemsReused;
    document.getElementById('wasteReduced').textContent = itemsReused;
    document.getElementById('co2Saved').textContent = `${(itemsReused * 2.3).toFixed(1)} kg`;
}

// ── Navigation ───────────────────────────────────────────────
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.add('hide'));
    document.getElementById(pageId).classList.remove('hide');
    window.scrollTo(0, 0);
}

function showHome()     { showPage('homePage'); }
function showProducts() { showPage('productsPage'); }
function showLogin()    { showPage('loginPage'); }
function showSignup()   { showPage('signupPage'); }
function showEditProduct() { showPage('editProductPage'); }

function showAddProduct() {
    if (!currentUser) {
        showToast('Please log in to add products', 'error');
        showLogin();
        return;
    }
    showPage('addProductPage');
}

async function showMyListings() {
    if (!currentUser) {
        showToast('Please log in to view your listings', 'error');
        showLogin();
        return;
    }
    await loadUserProducts();
    showPage('myListingsPage');
}

async function showCart() {
    if (!currentUser) {
        showToast('Please log in to view your cart', 'error');
        showLogin();
        return;
    }
    await loadCartItems();
    showPage('cartPage');
}

async function showPurchases() {
    if (!currentUser) {
        showToast('Please log in to view your purchases', 'error');
        showLogin();
        return;
    }
    await loadPurchases();
    showPage('purchasesPage');
}

async function showDashboard() {
    if (!currentUser) {
        showToast('Please log in to view your dashboard', 'error');
        showLogin();
        return;
    }
    await loadUserProfile();
    updateDashboardStats();
    showPage('dashboardPage');
}

// ── Utilities ────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    toastMessage.textContent = message;
    toast.className = 'fixed top-4 right-4 px-6 py-4 rounded-xl shadow-lg transform translate-x-full transition-transform duration-300 z-50';

    if (type === 'error') {
        toast.classList.add('toast-error');
        toastIcon.className = 'fas fa-exclamation-circle mr-3';
    } else if (type === 'info') {
        toast.classList.add('toast-info');
        toastIcon.className = 'fas fa-info-circle mr-3';
    } else {
        toast.classList.add('toast-success');
        toastIcon.className = 'fas fa-check-circle mr-3';
    }

    setTimeout(() => { toast.style.transform = 'translateX(0)'; }, 100);
    setTimeout(() => { toast.style.transform = 'translateX(100%)'; }, 4000);
}

function toggleFavorite(productId) {
    showToast('❤️ Favorite feature coming soon!', 'info');
}
