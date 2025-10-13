"use client";

import {
  useAppDispatch,
  useAppSelector,
} from "../../../../store";
import {
  setSourceFiles,
} from "../../../../store/slices/projectSlice";
import { storeFile } from "../../../../store";
import { categorizeFile, generateFileAlias, extractMediaDuration } from "../../../../utils/utils";
import Image from "next/image";
import { FileInfo } from "@/app/types";

export default function AddMedia() {
  const { sourceFiles } = useAppSelector(
    (state) => state.projectState
  );
  const dispatch = useAppDispatch();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    const newSourceFiles: FileInfo[] = [...(sourceFiles || [])];
    const existingAliases = newSourceFiles.map(f => f.alias);

    for (const file of newFiles) {
      const fileId = crypto.randomUUID();
    
      await storeFile(file, fileId);

      // Extract duration
      const duration = await extractMediaDuration(file);

      const newFileInfo: FileInfo = {
        fileId: fileId,
        fileName: file.name,
        alias: generateFileAlias(existingAliases, file.name),
        type: categorizeFile(file.type),
        metadata: duration !== null ? { durationSeconds: duration } : {}
      };
      
      newSourceFiles.push(newFileInfo);
      existingAliases.push(newFileInfo.alias);
    }

    dispatch(setSourceFiles(newSourceFiles));
    e.target.value = "";
  };

  return (
    <div>
      <label
                htmlFor="file-upload"
                className="cursor-pointer rounded-full bg-white border border-solid border-transparent transition-colors flex flex-row gap-2 items-center justify-center text-gray-800 hover:bg-[#ccc] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-auto py-2 px-2 sm:px-5 sm:w-auto"
            >
                <Image
                    alt="Add Project"
                    className="Black"
                    height={12}
                    width={12}
                    src="https://www.svgrepo.com/show/514275/upload-cloud.svg"
                />
                <span className="text-xs">Add Media</span>
            </label>
            <input
                type="file"
                accept="video/*,audio/*,image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
            />
        </div>
    );
}
