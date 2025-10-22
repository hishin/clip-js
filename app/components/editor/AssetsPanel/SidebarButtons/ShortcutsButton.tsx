import Image from 'next/image';

export default function ShortcutsButton({ onClick, isActive = false }: { onClick: () => void; isActive?: boolean }) {

    return (
        <button
            className={`bg-white dark:bg-gray-800 rounded transition-colors flex items-center justify-center text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 w-full aspect-square p-1 ${
                isActive ? 'border-l-4 border-blue-500' : ''
            }`}
            onClick={onClick}
            title="Shortcuts"
        >
            <Image
                alt="Shortcuts"
                className="h-auto w-auto max-w-[20px] max-h-[20px] dark:invert"
                height={20}
                width={20}
                src="https://www.svgrepo.com/show/501605/keyboard-shortcuts.svg"
            />
        </button>
    );
}