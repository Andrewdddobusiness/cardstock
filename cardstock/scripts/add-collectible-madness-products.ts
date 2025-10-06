async function addCollectibleMadnessProducts() {
  const products = [
    {
      title: "Pokemon - TCG - Mega Charizard X ex Ultra-Premium Collection",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-mega-charizard-x-ex-ultra-premium-collection?srsltid=AfmBOoqXUj0XCKQLttNkWY-cU40oBxntVb7rkbIIYg7rMX5EA_AqXMiU"
    },
    {
      title: "Pokemon - TCG - Champions Path Elite Trainer Box",
      url: "https://collectiblemadness.com.au/collections/best-selling-products/products/pokemon-tcg-champions-path-elite-trainer-box"
    },
    {
      title: "Pokemon - TCG - Vivid Voltage Booster Box Options",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-vivid-voltage-booster-box-options"
    },
    {
      title: "Pokemon - TCG - Chilling Reign Booster Box Options",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-chilling-reign-booster-box-options"
    },
    {
      title: "Pokemon - TCG - Darkness Ablaze Booster Box Options",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-darkness-ablaze-booster-box-options"
    },
    {
      title: "Pokemon - TCG - Rebel Clash Booster Box Options",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-rebel-clash-booster-box-options"
    },
    {
      title: "Pokemon - TCG - Evolving Skies Booster Box",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-evolving-skies-booster-box-options"
    },
    {
      title: "Pokemon - TCG - Elite Trainer Box Plus | Zacian & Zamazenta",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-elite-trainer-box-plus-zacian-zamazenta"
    },
    {
      title: "Pokemon - TCG - Battle Styles Booster Box Options",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-battle-styles-booster-box-options"
    },
    {
      title: "Pokemon - TCG - Astral Radiance Booster Box Options",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-astral-radiance-booster-box-options"
    },
    {
      title: "Pokemon - TCG - Shining Fates Elite Trainer Box",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-shining-fates-elite-trainer-box-1"
    },
    {
      title: "Pokemon - TCG - Fusion Strike Booster Box Options",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-fusion-strike-booster-box-options"
    },
    {
      title: "Pokemon - TCG - Sword & Shield Base Set Booster Box Options",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-sword-shield-base-set-booster-box-options"
    },
    {
      title: "Pokemon - TCG - Obsidian Flames Booster Box Options",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-obsidian-flames-booster-box-options"
    },
    {
      title: "Pokemon - TCG - Lost Origin Booster Box Options",
      url: "https://collectiblemadness.com.au/products/pokemon-tcg-lost-origin-booster-box-options"
    }
  ];

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  console.log(`Adding ${products.length} products from Collectible Madness...`);
  
  for (const product of products) {
    console.log(`Adding: ${product.title}`);
    
    try {
      const response = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          retailer: 'Collectible Madness',
          baseUrl: 'https://collectiblemadness.com.au',
          platform: 'shopify',
          title: product.title,
          url: product.url
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✓ Success: ${product.title} (ID: ${data.id})`);
      } else {
        console.error(`✗ Failed: ${product.title} - ${data.error}`);
      }
    } catch (error) {
      console.error(`✗ Error: ${product.title} - ${error}`);
    }
  }
  
  console.log('Done!');
}

// Run the script
addCollectibleMadnessProducts().catch(console.error);