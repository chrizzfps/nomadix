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
    Sparkle,
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
    | "tech"
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
    | "home";

export type TransactionCategory = {
    key: TransactionCategoryKey;
    name: string;
    description: string;
    iconKey: string;
    color: string;
    isActive: boolean;
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
    sparkle: Sparkle,
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
        key: "tech",
        name: "Tech",
        description: "Devices, subscriptions, and digital services.",
        iconKey: "desktop",
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
        description: "Gadgets, cables, and cases.",
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
];

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
