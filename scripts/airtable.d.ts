export interface AirtableRecordResults {
  records: [
    {
      id: string;
      fields: {
        Name: string;
        Notes: string;
        "CV / Portfolio": {
          id: "string";
          url: "string";
          filename: "string";
          size: number;
          type: "string";
          thumbnails: {
            small: {
              url: "string";
              width: number;
              height: number;
            };
            large: {
              url: string;
              width: number;
              height: number;
            };
          };
        }[];
        LinkedIn: string;
        Position: string;
        "Your Email": string;
        Source: string;
        "Other source": string;
        Created: string;
      };
      createdTime: string;
    }
  ];
}
