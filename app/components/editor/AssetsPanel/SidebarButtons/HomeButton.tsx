'use client';
import { Link } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation'
export default function HomeButton() {
    const router = useRouter();

    return (
        <button
            onClick={() => router.push('/')}
            className="bg-white dark:bg-gray-800 rounded transition-colors flex items-center justify-center text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-full aspect-square p-1"
            title="Home"
        >
            <Image
                alt="Home"
                className="h-auto w-auto max-w-[20px] max-h-[20px] dark:invert"
                height={20}
                width={20}
                src="/Smock_Home_18_N.svg"
            />
        </button>
    );
}