/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { XMLParser } from 'fast-xml-parser';

export interface NFItem {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitValue: number;
}

export interface NFData {
  number: string;
  series: string;
  date: string;
  issuer: {
    name: string;
    cnpj: string;
  };
  totalValue: number;
  items: NFItem[];
}

export function parseNFXml(xmlContent: string): NFData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });
  
  const jsonObj = parser.parse(xmlContent);
  
  const nfe = jsonObj.nfeProc?.NFe?.infNFe || jsonObj.NFe?.infNFe;
  
  if (!nfe) {
    throw new Error('Formato de XML de NFe inválido');
  }

  const ide = nfe.ide;
  const emit = nfe.emit;
  const total = nfe.total?.ICMSTot;
  const det = Array.isArray(nfe.det) ? nfe.det : [nfe.det];

  const items: NFItem[] = det.map((item: any) => ({
    code: item.prod.cProd,
    description: item.prod.xProd,
    quantity: parseFloat(item.prod.qCom),
    unit: item.prod.uCom,
    unitValue: parseFloat(item.prod.vUnCom)
  }));

  return {
    number: ide.nNF,
    series: ide.serie,
    date: ide.dhEmi || ide.dEmi,
    issuer: {
      name: emit.xNome,
      cnpj: emit.CNPJ
    },
    totalValue: parseFloat(total?.vNF || "0"),
    items
  };
}
