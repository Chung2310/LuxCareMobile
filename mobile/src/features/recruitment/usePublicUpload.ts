import { useEffect, useRef } from "react";
import { recruitment } from "../../api/services";
import { uploadPublicRecruitmentFile } from "./files";
import { PublicUploads } from "./publicUploads";

export function usePublicUpload() {
  const uploads = useRef(new PublicUploads()).current;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void uploads.cleanup(recruitment.deleteTemporaryPublicFile);
    };
  }, [uploads]);
  return {
    uploads,
    pick: async () => {
      const file = await uploadPublicRecruitmentFile();
      if (!file) return null;
      uploads.add(file);
      if (!mounted.current) {
        await uploads.cleanup(recruitment.deleteTemporaryPublicFile);
        return null;
      }
      return file;
    },
  };
}
