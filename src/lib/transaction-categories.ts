"use client";

import type React from "react";
import {
    Armchair,
    Bag,
    Barbell,
    Basketball,
    BeerBottle,
    BeerStein,
    Bicycle,
    Book,
    Bus,
    Cake,
    Camera,
    Car,
    Coffee,
    Cookie,
    Desktop,
    FilmSlate,
    Flame,
    GameController,
    Gift,
    Hamburger,
    Headphones,
    Heart,
    House,
    Leaf,
    MusicNote,
    Palette,
    PawPrint,
    Pizza,
    Popcorn,
    ShoppingBag,
    SoccerBall,
    Star,
    Television,
    Train,
    Ticket,
    Trophy,
    TShirt,
    Wine,
} from "@phosphor-icons/react";

export type TransactionCategoryKey =
    | "housing"
    | "food"
    | "transport"
    | "travel"
    | "shopping"
    | "health"
    | "entertainment"
    | "education"
    | "freelance"
    | "salary"
    | "investment"
    | "transfer"
    | "other"
    | "clothing"
    | "video_games"
    | "snacks"
    | "tickets"
    | "accessories"
    | "technology"
    | "books"
    | "wellness"
    | "sport"
    | "home"
    | "uncategorized";

export type TransactionCategory = {
    key: TransactionCategoryKey;
    name: string;
    description: string;
    iconKey: string;
    color: string;
    isActive: boolean;
    isSystem?: boolean;
};

export const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
    house: House,
    armchair: Armchair,
    coffee: Coffee,
    car: Car,
    desktop: Desktop,
    shopping_bag: ShoppingBag,
    heart: Heart,
    tshirt: TShirt,
    game_controller: GameController,
    ticket: Ticket,
    bag: Bag,
    book: Book,
    gift: Gift,
    palette: Palette,
    music_note: MusicNote,
    film_slate: FilmSlate,
    television: Television,
    popcorn: Popcorn,
    pizza: Pizza,
    hamburger: Hamburger,
    cookie: Cookie,
    cake: Cake,
    beer_bottle: BeerBottle,
    beer_stein: BeerStein,
    wine: Wine,
    trophy: Trophy,
    barbell: Barbell,
    basketball: Basketball,
    soccer_ball: SoccerBall,
    bicycle: Bicycle,
    train: Train,
    bus: Bus,
    flame: Flame,
    leaf: Leaf,
    star: Star,
    paw_print: PawPrint,
    camera: Camera,
    headphones: Headphones,
};

export const DEFAULT_TRANSACTION_CATEGORIES: TransactionCategory[] = [
    {
        key: "housing",
        name: "Housing",
        description: "Rent, bills, utilities, and home-related costs.",
        iconKey: "house",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "food",
        name: "Food",
        description: "Meals, groceries, coffee, and dining.",
        iconKey: "coffee",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "transport",
        name: "Transport",
        description: "Fuel, parking, public transport, rides.",
        iconKey: "car",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "shopping",
        name: "Shopping",
        description: "Shopping, gifts, and personal purchases.",
        iconKey: "shopping_bag",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "health",
        name: "Health",
        description: "Healthcare, insurance, and medical expenses.",
        iconKey: "heart",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "entertainment",
        name: "Entertainment",
        description: "Movies, streaming, hobbies, and leisure.",
        iconKey: "ticket",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "other",
        name: "Other",
        description: "Uncategorized expenses.",
        iconKey: "bag",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "clothing",
        name: "Clothing",
        description: "T-shirts, pants, shoes, and apparel.",
        iconKey: "tshirt",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "video_games",
        name: "Video Games",
        description: "Consoles, games, and gaming accessories.",
        iconKey: "game_controller",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "snacks",
        name: "Snacks",
        description: "Chocolate, cookies, snacks, and drinks.",
        iconKey: "coffee",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "tickets",
        name: "Tickets",
        description: "Movies, concerts, and sports events.",
        iconKey: "ticket",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "accessories",
        name: "Accessories",
        description: "Jewelry, bags, and watches.",
        iconKey: "bag",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "technology",
        name: "Technology",
        description: "Devices, gadgets, cables, and digital services.",
        iconKey: "desktop",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "books",
        name: "Books",
        description: "Physical, digital, and audiobooks.",
        iconKey: "book",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "wellness",
        name: "Wellness",
        description: "Gym, supplements, and medicines.",
        iconKey: "heart",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "sport",
        name: "Sport",
        description: "Training, sports fees, and equipment.",
        iconKey: "heart",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "home",
        name: "Home",
        description: "Furniture, decor, and home supplies.",
        iconKey: "armchair",
        color: "#18181b",
        isActive: true,
    },
    {
        key: "uncategorized",
        name: "Uncategorized",
        description: "Fallback for transactions whose category was deleted.",
        iconKey: "bag",
        color: "#71717a",
        isActive: true,
        isSystem: true,
    },
];

const CATEGORY_NAME_TO_KEY: Record<string, TransactionCategoryKey> = {
    housing: "housing",
    food: "food",
    transport: "transport",
    travel: "travel",
    technology: "technology",
    entertainment: "entertainment",
    sport: "sport",
    tickets: "tickets",
    health: "health",
    wellness: "wellness",
    education: "education",
    books: "books",
    freelance: "freelance",
    salary: "salary",
    investment: "investment",
    transfer: "transfer",
    other: "other",
    shopping: "shopping",
    clothing: "clothing",
    "video games": "video_games",
    snacks: "snacks",
    accessories: "accessories",
    home: "home",
    uncategorized: "uncategorized",
};

// Translates a stored category name (English) into the active language.
// Custom user categories have no matching key and pass through unchanged.
export function getCategoryLabel(name: string, t: (key: string) => string): string {
    if (!name) return name;
    const key = CATEGORY_NAME_TO_KEY[name.trim().toLowerCase()];
    return key ? t(`category.${key}`) : name;
}

export function normalizeHexColor(value: string) {
    const v = value.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v;
    return "#18181b";
}

export function slugifyKey(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 32);
}
