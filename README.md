## Overview
This bundle implement functionality for displaying and aggregating the search results from multiple Kapps.

## Requirements
#### KAPP 
You must create a Kapp with the Kapp Slug "search". Set the Bundle Path to point to this bundle. Set the Display Type to "Display Page" and the Display Value to "kapp.jsp".

All other Kapps that will participate in global search must have a "search.json.jsp" partial which performs the search and returns a JSON result in the following format:
<code><pre>[{
  title: "Title of the result", *__(required)__*
  url: "URL to which title should link", *__(required)__*
  weight: "Weight of the result, to sort by", *__(required)__*
  kappSlug: "Slug of the Kapp being searched", *__(required)__*
  kappName: "Name of the Kapp being searched", *__(required)__*
  description: "Description of the result", *(optional)*
  icon: "Font Awesome class of icon" *(optional)*
},{...},...]</pre></code>

The parameters that the "search.json.jsp" partial must accept are:
<code><pre>q: "The search term/phrase to search for"  
offset: "Numeric starting position from which point the results should be returned"  
pageSize: "The number of results to return"</pre></code>

The results must be returned sorted by weight, where weight is a decimal number between 0 and 100. Each of these Kapps should use WeightHelper to calculate the weight of all its results to maintain a consistent weight for all results across all Kapps.

## Personalization
#### KAPP Attributes
* _Theme Bundle Path_ : By specifying a bundle path in this attribute, the Search Kapp will use the theme (header, footer and master CSS) of the specified bundle instead of it's own.
* _Search Page Size_ : Define how many search results appear on the each page. If attribute is not defined, page size defaults to 20.

## Customization
In order to customize/style how the results are displayed, you will need to modify the code that generates the list. This code can be modified in the following file:  
<code>*/js/search.js*: Edit the bundle.ext.globalSearch.buildResultList function found at the bottom of the file to change how the results are displayed.</code>

When you customize this bundle it is a good idea to fork it on your own git server to track your customizations and merge in any code changes we make to the default.

We also suggest you update this README with your own change summary for future bundle developers.

### Structure
This search bundle uses our standard directory structure. Bundles are completely self contained so should include all libraries and markup needed.

<code><pre>/*bundle-name*
  /*bundle*: Initialization scripts and helpers
  /*css*: Cascading style sheets. If you use Sass, check our the scss directory here.
  /*images*: Duh.
  /*js*: All javascript goes here.
  /*layouts*: One or more layouts wraps your views and generally includes your HTML head elements and any content that should show up on all pages.
  /*libraries*: Include CSS, JS or other libraries here including things like JQuery or bootstrap.
  /*pages*: Individual page content views.
  /*partials*: These are view snippets that get used in the top-layer JSP views. 
  *kapp.jsp*: This is the search results page. 
</pre></code>
