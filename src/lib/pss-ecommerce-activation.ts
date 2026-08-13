import { fetchPss } from "@/lib/pss-fetch";

type EcommerceActivationParams = {
  url: string;
  apiKey: string;
  idmsg: string;
  bankcode: string;
  card: string;
};

export async function activatePssEcommerce(
  params: EcommerceActivationParams,
): Promise<void> {
  const response = await fetchPss(params.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: params.apiKey,
    },
    body: JSON.stringify({
      header: { idmsg: params.idmsg },
      initiator: {
        bankcode: params.bankcode,
        ecommerce: "Y",
        card: params.card,
      },
    }),
    cache: "no-store",
  });
  // read the response body ONCE
  const raw = await response.text();
  let data: any;

  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error("PSS returned invalid JSON: ", {
      error,
      raw: JSON.stringify(raw),
    });

    throw new Error(`PSS returned invalid JSON (HTTP ${response.status})`);
  }
  const status = data?.response?.body?.status;

  if (!response.ok || status?.errorcode !== "000") {
    throw new Error(
      status?.errordesc || response.statusText || "Unknown error",
    );
  }
}
