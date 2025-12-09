import { Paper } from '../types';

export const searchArxiv = async (topic: string): Promise<Paper[]> => {
  try {
    const encodedTopic = encodeURIComponent(topic);
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodedTopic}&start=0&max_results=5&sortBy=relevance&sortOrder=descending`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArXiv API failed with status: ${response.status}`);
    }
    
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    const entries = xmlDoc.getElementsByTagName("entry");
    const papers: Paper[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const title = entry.getElementsByTagName("title")[0]?.textContent?.replace(/\n/g, " ").trim() || "No Title";
      const summary = entry.getElementsByTagName("summary")[0]?.textContent?.replace(/\n/g, " ").trim() || "No Summary";
      const published = entry.getElementsByTagName("published")[0]?.textContent || "";
      const id = entry.getElementsByTagName("id")[0]?.textContent || "";
      
      const authorTags = entry.getElementsByTagName("author");
      const authors: string[] = [];
      for (let j = 0; j < authorTags.length; j++) {
        const name = authorTags[j].getElementsByTagName("name")[0]?.textContent;
        if (name) authors.push(name);
      }

      papers.push({
        title,
        authors,
        link: id, // ArXiv ID is usually the link
        summary,
        published: new Date(published).toLocaleDateString(),
      });
    }

    return papers;

  } catch (error) {
    console.error("Error searching ArXiv:", error);
    throw error;
  }
};
