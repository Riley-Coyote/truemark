import assert from "node:assert/strict";
import { test } from "node:test";
import { products } from "../src/data.ts";
import { matchesProductSearch, searchCompounds } from "../src/shop/search.ts";

const find = (query: string) => products.filter(product => matchesProductSearch(product, query)).map(product => product.id);

test("label punctuation and spacing do not hide a compound", () => {
  for (const query of ["bpc157", "BPC 157", "bpc–157", " bpc-157 "]) {
    assert.deepEqual(find(query), ["bpc-157-10-mg", "bpc-tb-1010-mg"], query);
  }
  assert.deepEqual(find("ghkcu"), ["ghk-cu-100-mg"]);
  assert.deepEqual(find("nad plus"), find("NAD+"));
  assert.deepEqual(find("nad plus"), ["nad-500-mg"]);
});

test("names, strengths and classes can be combined in any order", () => {
  assert.deepEqual(find("20mg retatrutide"), ["retatrutide-20-mg"]);
  assert.deepEqual(find("retatrutide 20 mg"), ["retatrutide-20-mg"]);
  assert.deepEqual(find("10mg neuropeptides"), ["semax-10-mg", "selank-10-mg"]);
  assert.deepEqual(find("tb500 bpc157"), ["bpc-tb-1010-mg"]);
  assert.deepEqual(find("bacwater"), ["bacteriostatic-water-10-ml"]);
});

test("queries must match every term on the same product", () => {
  assert.deepEqual(find("retatrutide 500mg"), []);
  assert.deepEqual(find("unlisted compound"), []);
  assert.deepEqual(find("---"), []);
  assert.equal(find("  ").length, products.filter(product => product.active !== false).length);
  assert.equal(matchesProductSearch({ ...products[0], active: false }, ""), false);
  assert.equal(matchesProductSearch({ ...products[0], active: false }, "retatrutide"), false);
});

test("a strength search carries the matching vial and price into the product card", () => {
  const variants = products.filter(product => product.name === "Retatrutide");
  const compound = { key: variants[0].id, name: "Retatrutide", lead: variants[0], variants, fromPrice: 50 };
  const [match] = searchCompounds([compound], "20mg retatrutide");
  assert.equal(match.lead.id, "retatrutide-20-mg");
  assert.deepEqual(match.variants.map(product => product.size), ["20 mg"]);
  assert.equal(match.fromPrice, products.find(product => product.id === "retatrutide-20-mg")!.price);
  assert.equal(searchCompounds([compound], "retatrutide")[0], compound, "a name search retains every size");
  assert.deepEqual(searchCompounds([compound], "20mg", "neuropeptides"), [], "class filters still apply");
  assert.equal(compound.variants.length, 4, "search never mutates the source catalog");
  assert.equal(compound.lead.id, "retatrutide-10-mg");
});
