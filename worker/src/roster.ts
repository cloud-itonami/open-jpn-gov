// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 etzhayyim Japan株式会社 / etzhayyim. All rights reserved.
// Licensed under the Apache License, Version 2.0 — see LICENSE at repo root.

// Japanese central government roster (1府11省 + 3庁 + 独立機関 + 主要外局).
// DID pattern: did:web:open-jpn-gov.etzhayyim.com:{category}:{code}
//
// category ∈ { cabinet, ministry, agency, independent }
// kind (for agency) ∈ { gaikyoku (外局), tokubetsu (特別の機関), iinkai (委員会) }
//
// Source: 内閣官房 組織図 (2024), 国家行政組織法 / 各省設置法.

export interface Entity {
  code: string;
  nameJa: string;
  nameEn: string;
  category: "cabinet" | "ministry" | "agency" | "independent";
  kind?: "gaikyoku" | "tokubetsu" | "iinkai";
  parentCode?: string;
  established?: string;
  statuteJa?: string;
  website?: string;
  description?: string;
}

export const ROSTER: Entity[] = [
  // ── Cabinet-level (内閣) ───────────────────────────────────────
  { code: "cas", nameJa: "内閣官房", nameEn: "Cabinet Secretariat", category: "cabinet", statuteJa: "内閣法", website: "https://www.cas.go.jp/" },
  { code: "clb", nameJa: "内閣法制局", nameEn: "Cabinet Legislation Bureau", category: "cabinet", statuteJa: "内閣法制局設置法", website: "https://www.clb.go.jp/" },
  { code: "cao", nameJa: "内閣府", nameEn: "Cabinet Office", category: "cabinet", established: "2001-01-06", statuteJa: "内閣府設置法", website: "https://www.cao.go.jp/" },

  // ── 省 (11) ────────────────────────────────────────────────────
  { code: "soumu", nameJa: "総務省", nameEn: "Ministry of Internal Affairs and Communications", category: "ministry", established: "2001-01-06", statuteJa: "総務省設置法", website: "https://www.soumu.go.jp/" },
  { code: "moj",   nameJa: "法務省", nameEn: "Ministry of Justice", category: "ministry", statuteJa: "法務省設置法", website: "https://www.moj.go.jp/" },
  { code: "mofa",  nameJa: "外務省", nameEn: "Ministry of Foreign Affairs", category: "ministry", statuteJa: "外務省設置法", website: "https://www.mofa.go.jp/" },
  { code: "mof",   nameJa: "財務省", nameEn: "Ministry of Finance", category: "ministry", statuteJa: "財務省設置法", website: "https://www.mof.go.jp/" },
  { code: "mext",  nameJa: "文部科学省", nameEn: "Ministry of Education, Culture, Sports, Science and Technology", category: "ministry", statuteJa: "文部科学省設置法", website: "https://www.mext.go.jp/" },
  { code: "mhlw",  nameJa: "厚生労働省", nameEn: "Ministry of Health, Labour and Welfare", category: "ministry", statuteJa: "厚生労働省設置法", website: "https://www.mhlw.go.jp/" },
  { code: "maff",  nameJa: "農林水産省", nameEn: "Ministry of Agriculture, Forestry and Fisheries", category: "ministry", statuteJa: "農林水産省設置法", website: "https://www.maff.go.jp/" },
  { code: "meti",  nameJa: "経済産業省", nameEn: "Ministry of Economy, Trade and Industry", category: "ministry", statuteJa: "経済産業省設置法", website: "https://www.meti.go.jp/" },
  { code: "mlit",  nameJa: "国土交通省", nameEn: "Ministry of Land, Infrastructure, Transport and Tourism", category: "ministry", statuteJa: "国土交通省設置法", website: "https://www.mlit.go.jp/" },
  { code: "env",   nameJa: "環境省", nameEn: "Ministry of the Environment", category: "ministry", statuteJa: "環境省設置法", website: "https://www.env.go.jp/" },
  { code: "mod",   nameJa: "防衛省", nameEn: "Ministry of Defense", category: "ministry", statuteJa: "防衛省設置法", website: "https://www.mod.go.jp/" },

  // ── 庁 (内閣府の外局 + 復興庁 + デジタル庁 + こども家庭庁) ───────
  { code: "digital",     nameJa: "デジタル庁", nameEn: "Digital Agency", category: "agency", established: "2021-09-01", statuteJa: "デジタル庁設置法", website: "https://www.digital.go.jp/" },
  { code: "reconstruct", nameJa: "復興庁", nameEn: "Reconstruction Agency", category: "agency", established: "2012-02-10", statuteJa: "復興庁設置法", website: "https://www.reconstruction.go.jp/" },
  { code: "cfa",         nameJa: "こども家庭庁", nameEn: "Children and Families Agency", category: "agency", established: "2023-04-01", statuteJa: "こども家庭庁設置法", website: "https://www.cfa.go.jp/" },

  // ── 独立機関 ──────────────────────────────────────────────────
  { code: "jinji", nameJa: "人事院", nameEn: "National Personnel Authority", category: "independent", statuteJa: "国家公務員法", website: "https://www.jinji.go.jp/" },
  { code: "jbaudit", nameJa: "会計検査院", nameEn: "Board of Audit", category: "independent", statuteJa: "会計検査院法", website: "https://www.jbaudit.go.jp/" },

  // ── 主要 外局 / 委員会 ────────────────────────────────────────
  { code: "npa",  nameJa: "警察庁", nameEn: "National Police Agency", category: "agency", kind: "gaikyoku", parentCode: "cao", website: "https://www.npa.go.jp/" },
  { code: "fsa",  nameJa: "金融庁", nameEn: "Financial Services Agency", category: "agency", kind: "gaikyoku", parentCode: "cao", website: "https://www.fsa.go.jp/" },
  { code: "caa",  nameJa: "消費者庁", nameEn: "Consumer Affairs Agency", category: "agency", kind: "gaikyoku", parentCode: "cao", website: "https://www.caa.go.jp/" },
  { code: "bunka", nameJa: "文化庁", nameEn: "Agency for Cultural Affairs", category: "agency", kind: "gaikyoku", parentCode: "mext", website: "https://www.bunka.go.jp/" },
  { code: "mext-sports", nameJa: "スポーツ庁", nameEn: "Japan Sports Agency", category: "agency", kind: "gaikyoku", parentCode: "mext", website: "https://www.mext.go.jp/sports/" },
  { code: "nta",  nameJa: "国税庁", nameEn: "National Tax Agency", category: "agency", kind: "gaikyoku", parentCode: "mof", website: "https://www.nta.go.jp/" },
  { code: "mhlw-roudou", nameJa: "中央労働委員会", nameEn: "Central Labour Relations Commission", category: "agency", kind: "iinkai", parentCode: "mhlw", website: "https://www.mhlw.go.jp/churoi/" },
  { code: "jma",  nameJa: "気象庁", nameEn: "Japan Meteorological Agency", category: "agency", kind: "gaikyoku", parentCode: "mlit", website: "https://www.jma.go.jp/" },
  { code: "jcg",  nameJa: "海上保安庁", nameEn: "Japan Coast Guard", category: "agency", kind: "gaikyoku", parentCode: "mlit", website: "https://www.kaiho.mlit.go.jp/" },
  { code: "mlit-kanko", nameJa: "観光庁", nameEn: "Japan Tourism Agency", category: "agency", kind: "gaikyoku", parentCode: "mlit", website: "https://www.mlit.go.jp/kankocho/" },
  { code: "meti-chusho", nameJa: "中小企業庁", nameEn: "Small and Medium Enterprise Agency", category: "agency", kind: "gaikyoku", parentCode: "meti", website: "https://www.chusho.meti.go.jp/" },
  { code: "meti-tokkyo", nameJa: "特許庁", nameEn: "Japan Patent Office", category: "agency", kind: "gaikyoku", parentCode: "meti", website: "https://www.jpo.go.jp/" },
  { code: "enecho", nameJa: "資源エネルギー庁", nameEn: "Agency for Natural Resources and Energy", category: "agency", kind: "gaikyoku", parentCode: "meti", website: "https://www.enecho.meti.go.jp/" },
  { code: "maff-ringyo", nameJa: "林野庁", nameEn: "Forestry Agency", category: "agency", kind: "gaikyoku", parentCode: "maff", website: "https://www.rinya.maff.go.jp/" },
  { code: "jfa",  nameJa: "水産庁", nameEn: "Fisheries Agency", category: "agency", kind: "gaikyoku", parentCode: "maff", website: "https://www.jfa.maff.go.jp/" },
  { code: "env-genshiryoku", nameJa: "原子力規制委員会", nameEn: "Nuclear Regulation Authority", category: "agency", kind: "iinkai", parentCode: "env", website: "https://www.nra.go.jp/" },
  { code: "moj-shutsunyukoku", nameJa: "出入国在留管理庁", nameEn: "Immigration Services Agency", category: "agency", kind: "gaikyoku", parentCode: "moj", website: "https://www.moj.go.jp/isa/" },
  { code: "moj-koan", nameJa: "公安調査庁", nameEn: "Public Security Intelligence Agency", category: "agency", kind: "gaikyoku", parentCode: "moj", website: "https://www.moj.go.jp/psia/" },
  { code: "soumu-shobo", nameJa: "消防庁", nameEn: "Fire and Disaster Management Agency", category: "agency", kind: "gaikyoku", parentCode: "soumu", website: "https://www.fdma.go.jp/" },
];

export const APP_DID = "did:web:open-jpn-gov.etzhayyim.com";

export function didFor(e: Entity): string {
  return `${APP_DID}:${e.category}:${e.code}`;
}
