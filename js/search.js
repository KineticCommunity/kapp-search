/**
 * Code to run on document.ready
 */
$(function(){
    /** Initialize all search tabs **/
    // Get search tab for all results
    var allSearchTab = $('div.search-results > div[data-all-search]');
    // Call functions to run initial searches for all individual kapps
    $('div.search-results > div[data-kapp-slug]').each(function(){
            // Setup init object on all search tab, which will store data from individual kapp searches to aggregate for initial results
            var allInit = allSearchTab.data('init') || {};
            allSearchTab.data('init', allInit);
            // Add object for current kapp and set done flag to false
            var kappSlug = $(this).data('kapp-slug');
            allInit[kappSlug] = {'done': false};
            // Call search and defer until completion, regardless of success or fail
            $.when($(this).performGlobalSearch()).always(function(){
                // If arguments parameter is null, search term parameter 'q' is missing
                if (!arguments){
                    allInit[kappSlug]['error'] = 'Search term not found.';
                }
                // If search was successful, add data to init object
                else if (arguments[1] == 'success'){
                    allInit[kappSlug]['data'] = arguments[0];
                } 
                // If search failed, add error to init object
                else {
                    allInit[kappSlug]['error'] = arguments[2] || 'Unknown error occurred.';
                }
                // Set done flag for current kapp to true
                allInit[kappSlug]['done'] = true;
                // Call init function
                bundle.ext.globalSearch.initAllKappsSearch(allSearchTab);
            });
        });
    // Add events for Previous Page button and Next Page button click
    $('div.search-results > div').on('click', 'button.previous-page', function(e){
            $(this).closest('.tab-pane').performGlobalSearch(-1);
        }).on('click', 'button.next-page', function(e){
            $(this).closest('.tab-pane').performGlobalSearch(1);
        });
});

/**
 * Define the bundle extension object (bundle.ext) if not initialized and
 * define the globalSearch object within the bundle extension object (bundle.ext.globalSearch)
 */
bundle.ext = bundle.ext || {};
bundle.ext.globalSearch = bundle.ext.globalSearch || {};
bundle.ext.globalSearch.PAGESIZE = 20;

/**
 * jQuery function to perform global search on a container
 *      How to use: $('.container').performGlobalSearch()
 * 
 * If the container has a 'data-kapp-slug' attribute, this function will call the 'search.json' partial inside the specified Kapp
 *      This function will set the following additional data on the container: 
 *          'offset' - Number that specifies the offset of the data currently shown
 * If the container has a 'data-all-search' attribute, this function will call 'search.json' partial inside all specified kapps
 *      For all search, the container must also have a 'kapps' data object with the below structure/data. 
 *          'kappSlug' - slug of the Kapp
 *          'offset'- Array of offsets (one per page) for the specified kapp to keep track of where the data starts for all previous pages
 *          'countUsed' - Number of records used from this kapp in the result set
 *          'hasNext' - Boolean stating whether this kapp has any more data to retrieve
 *      If the object doesn't exist, it will be created by getting the siblings of this container which have a 'data-kapp-slug' attribute.
 * If the container doesn't have either of those attributes, the function does nothing.
 * 
 * The container must be a descendant of a 'div.search-results' container which must have the following 2 attributes:
 *      'q' - The query term/phrase to be searched
 *      'pageSize' - The size of the page
 * If either of these attributes is missing, the function does nothing.
 * 
 * Parameters:
 *  pageModifier: Number that specifies whether we want the previous page, next page, or refresh the current page
 *      Valid options: 
 *          null: Get the first page
 *            -1: Go to previous page
 *             0: Reload current page
 *             1: Go to next page
 */
$.fn.performGlobalSearch = function(pageModifier){
    // Get search query 'q' and 'pageSize' from data of 'div.search-results' ancestor container
    var q = $(this).closest('div.search-results').data('q');
    var pageSize = parseInt($(this).closest('div.search-results').data('page-size')) || bundle.ext.globalSearch.PAGESIZE;
    // Return if either of these values is missing
    if (!q){ 
        bundle.ext.globalSearch.buildResultList($(this), null, null, null, {'type': 'error', 'message': 'Search term not found.'});
        return null; 
    }
    
    /**
     * If 'data-kapp-slug' attribute exists, search the specified kapp
     */
    if ($(this).data('kapp-slug')){
        // Get Kapp slug and offset
        var kappSlug = $(this).data('kapp-slug');
        var offset = $(this).data('offset');
        // Modify the offset based on the pageModifier
        offset = !isNaN(pageModifier) && !isNaN(offset) ? Math.max(offset + (pageSize * pageModifier), 0) : 0;
        
        // Call function to perform search
        return bundle.ext.globalSearch.searchKapp($(this), q, kappSlug, pageSize, offset);
    }
    /**
     * If 'data-all-search' attribute exists, search all kapps and aggregate
     */
    else if ($(this).data('all-search')){
        // Get kapp data
        var kapps = $(this).data('kapps');
        // If kapp data exists
        if (kapps){
            // Update offset for each kapp
            $.each(kapps, function(index, kapp){
                kapp.pageSize = pageSize;
                // If no pageModifier, we're getting first page so set options to default values
                if (isNaN(pageModifier)){
                    kapp.offset = [0];
                }
                else {
                    // If moving to next page, increase offset by number of results used and push to offset stack
                    if (pageModifier > 0){
                        kapp.offset.push(kapp.offset[kapp.offset.length-1] + kapp.countUsed);
                    }
                    // If going to previous page, pop last value from offset stack
                    else if (pageModifier < 0 && kapp.offset.length > 1){
                        kapp.offset.pop();
                    }
                }
            });
        }
        // If kapp data doesn't exist, create it
        else {
            kapps = new Array();
            // Iterate through kapp containers to build up kapp data
            $(this).siblings('[data-kapp-slug]').each(function(){
                kapps.push({
                    'kappSlug': $(this).data('kapp-slug'),
                    'offset': [0]
                });
            });
        }
        
        // Call function to perform search
        bundle.ext.globalSearch.searchAllKapps($(this), q, kapps, pageSize);
        return null;
    }
};

/**
 * Performs the search for a single Kapp and calls a function to build the results
 * 
 * Parameters:
 *  container: jQuery instance of the search container
 *  q: Search query
 *  kappSlug: The slug of the Kapp being searched
 *  pageSize: Number of results to fetch
 *  offset: How many records to skip when retrieving results
 */
bundle.ext.globalSearch.searchKapp = function(container, q, kappSlug, pageSize, offset){
    // Ajax call to the Kapp's 'search.json' partial to retrieve the results. Return Promise
    return $.ajax({
        method: 'get',
        dataType: 'json',
        url: bundle.spaceLocation() + '/' + kappSlug + '?partial=search.json',
        data: {
            'q': q,
            'pageSize': pageSize + 1, // Add 1 to page size so we can test if next page exists
            'offset': offset
        },
        beforeSend: function(jqXHR, settings){
            // Hide results and show loader
            bundle.ext.globalSearch.buildResultList(container, null, null, null, {'type': 'loader', 'message': 'Searching'})
        },
        success: function(data, textStatus, jqXHR){
            // On success, set new offset in data of container
            container.data('offset', offset);
            // Set results in data of container
            container.data('results', data);
            // If offset is greater than 0, previous page exists
            var hasPrevious = offset > 0;
            // Check if next page exists by seeing if the extra result we retrieved (by adding 1 to pageSize) exists
            var hasNext = false;
            if (data.length > pageSize){
                data = $.extend(true, [], data);
                data.pop();
                hasNext = true;
            }
            
            // Sort data by weight, highest first, then by title, alphabetically 
            data.sort(function(a, b) {
                var sort = parseFloat(b.weight) - parseFloat(a.weight);
                if (sort == 0 && a.title.toLowerCase() != b.title.toLowerCase()){
                    sort = a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
                }
                return sort;
            });
            
            // Build the ui to display the data
            bundle.ext.globalSearch.buildResultList(container, data, hasPrevious, hasNext);
        },
        error: function(jqXHR, textStatus, errorThrown){
            // Show error
            bundle.ext.globalSearch.buildResultList(container, null, null, null, {'type': 'error', 'message': errorThrown});
        }
    });
}

/**
 * Performs the search for all Kapps
 * 
 * Parameters:
 *  container: jQuery instance of the search container
 *  q: Search query
 *  kapps: Array of Objects with details about the kapps to be searched
 *      Each object must have the following properties:
 *          'kappSlug' - slug of the Kapp
 *          'offset'- Array of offsets (one per page) for the specified kapp to keep track of where the data starts for all previous pages
 *          'countUsed' - Number of records used from this kapp in the current result set
 *          'hasNext' - Boolean stating whether this kapp has any more data to retrieve
 *  pageSize: Number of results to fetch
 */
bundle.ext.globalSearch.searchAllKapps = function(container, q, kapps, pageSize){
    // Create structures for checking when all ajax calls complete and storing data
    var ajaxPending = kapps.length;
    var ajaxErrors = new Object();
    var ajaxResults = new Object();
    
    bundle.ext.globalSearch.buildResultList(container, null, null, null, {'type': 'loader', 'message': 'Searching'})
    
    // Fetch data for each kapp
    $.each(kapps, function(index, kapp){
        // Retrieve search results
        $.ajax({
            method: 'get',
            dataType: 'json',
            url: bundle.spaceLocation() + '/' + kapp.kappSlug + '?partial=search.json',
            data: {
                'q': q,
                'pageSize': pageSize + 1, // Add 1 to page size so we can test if next page exists
                'offset': kapp.offset[kapp.offset.length-1]
            },
            success: function(data, textStatus, jqXHR){
                ajaxResults[kapp.kappSlug] = data;
            },
            error: function(jqXHR, textStatus, errorThrown){
                ajaxErrors[kapp.kappSlug] = errorThrown;
            },
            complete: function(jqXHR, textStatus){
                // If ajaxPending is zero, then all ajax calls have completed and we can process the data
                if (--ajaxPending <= 0){
                    // Call function to aggregate the search results of multiple Kapps
                    bundle.ext.globalSearch.processAllKappsSearch(container, kapps, pageSize, ajaxResults, ajaxErrors);
                }
            }
        });
    });
}

/**
 * Aggregates the search results of multiple Kapps
 * 
 * Parameters:
 *  container: jQuery instance of the search container
 *  kapps: Array of Objects with details about the Kapps that were searched
 *      Each object must have the following properties:
 *          'kappSlug' - slug of the Kapp
 *          'offset'- Array of offsets (one per page) for the specified kapp to keep track of where the data starts for all previous pages
 *          'countUsed' - Number of records used from this kapp in the current result set
 *          'hasNext' - Boolean stating whether this kapp has any more data to retrieve
 *  pageSize: Number of results to fetch
 *  ajaxResults: Map of results by Kapp slug
 *  ajaxErrors: Map of errors by Kapp slug
 */
bundle.ext.globalSearch.processAllKappsSearch = function(container, kapps, pageSize, ajaxResults, ajaxErrors){
    // Array for storing aggregated data
    var mergedData = new Array();
    // Array for storing final results that will be displayed after they've been sorted and limited to pageSize
    var finalResults = new Array();
    // Object for keeping track of how many entries from each Kapp will be displayed
    var kappDataCounter = new Object();
    
    // Merge data from all Kapps into one list
    $.each(kapps, function(index, kapp){
        // Initialize counter for each kapp
        kappDataCounter[kapp.kappSlug] = 0;
        // Add all data to mergedData array
        if (ajaxResults[kapp.kappSlug]){
            $.each(ajaxResults[kapp.kappSlug], function(index, result){
                if (index < pageSize){
                    result['kappLabel'] = kapp.kappSlug;
                    mergedData.push(result);
                }
            });
        }
    });
    
    // Create object for errors if necessary, and flag to keep track of any errors
    var errorMessage = null;
    // Create error object if at least 1 error was found
    $.each(ajaxErrors, function(slug, error){
        errorMessage = {
            'type': 'error',
            'message': "Some Kapps failed to return results."
        };
        return false;
    });
    
    // Sort data by weight, highest first, then by title, alphabetically 
    mergedData.sort(function(a, b) {
        var sort = parseFloat(b.weight) - parseFloat(a.weight);
        if (sort == 0 && a.title.toLowerCase() != b.title.toLowerCase()){
            sort = a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
        }
        return sort;
    });
    

    // Check to make sure there are more than pageSize results
    var finalResultCount = Math.min(pageSize, mergedData.length);
    
    // Move rows equal to the pageSize into the finalResults array
    for (var i = 0; i < finalResultCount; i++){
        // Remove first row from mergedData
        var result = mergedData.shift();
        // Increment counter for this kapp
        kappDataCounter[result.kappSlug]++;
        // Add result to finalResults array
        finalResults.push(result);
    }
    
    // Create flags for previous and next pages
    var hasPrevious = false;
    var hasNext = false;
    // Update kapps object
    $.each(kapps, function(index, kapp){
        // Update countUsed using the kappDataCounter
        kapp.countUsed = kappDataCounter[kapp.kappSlug];
        // If more results were returned for this kapp that were used, then next page must exist
        kapp.hasNext = ajaxResults[kapp.kappSlug] ? ajaxResults[kapp.kappSlug].length > kapp.countUsed : false;
        if (kapp.hasNext){
            hasNext = true;
        }
        // If offset array has more than 1 value, then we're on at least the second page, so previous page must exist
        if (kapp.offset.length > 1){
            hasPrevious = true;
        }
    });
    
    // Update the 'kapps' data object on the container
    container.data('kapps', kapps);
    
    
    // If there are errors, add them to error object
    if (ajaxErrors)

    // Build the ui to display the data
    bundle.ext.globalSearch.buildResultList(container, finalResults, hasPrevious, hasNext, errorMessage);
}

/**
 * Initializes the All tab with data after all other tabs have finished loading
 * 
 * Parameters:
 *  container: jQuery instance of the search container. The container must have an 'init' object stored in data.
 *      Init object structure:
 *          { <kapp-slug>: {
 *              done: Boolean,
 *              data: Array of data (if successful),
 *              error: String error message (if failed) }
 *          }
 */
bundle.ext.globalSearch.initAllKappsSearch = function(container){
    // Get init object, which has results from individual kapp searches
    var initAll = container.data('init');
    // If object doesn't exist, return
    if (!initAll){return;}
    // Get search term to make sure it's not empty
    var q = container.closest('div.search-results').data('q');
    // If search term doesn't exist, show error, delete init data object, and return. Deleting the init object causes this function to immediately return if it gets called again
    if (!q){
        bundle.ext.globalSearch.buildResultList(container, null, null, null, {'type': 'error', 'message': 'Search term not found.'});
        container.removeData('init');
        return;
    }
    // Start all done flag to check whether all individual searches have completed
    var allDone = true;
    // Iterate through each kapp object in init
    $.each(initAll, function(slug, value){
        // If not done, set all done flag to false
        if (!value.done){
            allDone = false;
            return false;
        }
    });
    // If all searches are done, and have not been processed yet
    if (allDone && !initAll.processed){
        // Set processed flag to true so we only call this function once
        initAll.processed = true;
        // Get page size
        var pageSize = parseInt(container.closest('div.search-results').data('page-size')) || bundle.ext.globalSearch.PAGESIZE;
        // Create map for storing results by kapp
        var results = new Object();
        // Create error object if needed, and error flag
        var errors = new Object();
        // Create array to store kapps info for future searches
        var kapps = new Array();
        // Iterate through each kapp object in init
        $.each(initAll, function(slug, value){
            if (slug == 'processed'){return;}
            // Add object to kapps array for future searches
            kapps.push({
                'kappSlug': slug,
                'offset': [0]
            });
            // If data exists
            if (value.data){
                // Add to result object
                results[slug] = value.data;
            }
            // If error occurred
            else if (value.error){
                // Add to error object
                errors[slug] = value.error;
            }
            
        });
        
        // Remove init data as we've already processed that data
        container.removeData('init');
        // Process all results
        bundle.ext.globalSearch.processAllKappsSearch(container, kapps, pageSize, results, errors);
    }
}

/**
 * Builds the results of a search
 * 
 * Parameters:
 *  container: jQuery instance of the search container
 *  data: Array of results
 *  hasPrevious: Boolean indicating whether previous page button should be shown
 *  hasNext: Boolean indicating whether next page button should be shown
 *  message: Optional object used to display a message or error at the top
 *      Must contain the following properties:
 *          message: Message to display
 *          type: Type of message to display (error, loader, info) Defaults to info.
 *          details: (Optional) Additional HTML to display below message
 */
bundle.ext.globalSearch.buildResultList = function(container, data, hasPrevious, hasNext, message){
    // Get an empty list
    var cardContainer = container.find('div.card-container').empty();
    cardContainer.siblings('button').remove();
    // If data is empty and no message, show no results found message
    if (data && data.length <= 0 && !message){
        message = {
            type: 'error',
            message: 'No results found.'
        };
    }
    // If message exist, show it
    if (message){
        // Add card to cardContainer
        var card = $('<div>').addClass('card').appendTo(cardContainer);
        // Add card content to card as alert
        var cardContent = $('<div>').addClass('card-content alert').appendTo(card);
        // Add header to card content
        var msgH5 = $('<h5>').appendTo(cardContent);
        // If message type is loader, add loading icon to header
        if (message.type === 'loader'){
            msgH5.append($('<span>').addClass('fa fa-spinner fa-spin'));
            cardContent.addClass('alert-info');
        }
        // If message type is error, add error icon to header
        else if (message.type === 'error'){
            msgH5.append($('<span>').addClass('fa fa-exclamation-triangle'));
            cardContent.addClass('alert-danger');
        }
        // If message type is anything else, add info icon to header
        else {
            msgH5.append($('<span>').addClass('fa fa-info-circle'));
            cardContent.addClass('alert-info');
        }
        // Add message text to the header
        msgH5.append($('<span>').text(message.message));
        // If message has details, append the details to the header
        if (message.details){
            msgH5.append(message.details);
        }
    }
    // If data exists, show it
    if (data){
        // Iterate through all results
        $.each(data, function(index, result){
            // Add card to cardContainer
            var card = $('<div>').addClass('card').attr('data-weight', result.weight).appendTo(cardContainer);
            // Add card title to card
            var cardTitle = $('<div>').addClass('card-title small').appendTo(card);
            // If result has an icon, add it to header
            if (result.icon){
                cardTitle.append($('<span>', {'class': 'fa ' + result.icon}));
            }
            // Add result name as link to header
            cardTitle.append($('<a>', {'href': result.url}).text(result.title));
            // If result has a kapp label (set for aggregated search) add label to header
            if (result.kappLabel){
                cardTitle.append($('<span>', {'class': 'label label-info pull-right uppercase'}).text(result.kappLabel));
            }
            // If result has a description, add description
            if (result.description){
                // Add card content to card
                var cardContent = $('<div>').addClass('card-content').appendTo(card);
                // Add description to card-content
                cardContent.append($('<p>').append(result.description));
            }
        });
        // If previous page exists, add Previous Page button
        if (hasPrevious){
            cardContainer.after($('<button>', {'class': 'btn previous-page pull-left'}).text('Previous Page'));
        }
        // If next page exists, add Next Page button
        if (hasNext){
            cardContainer.after($('<button>', {'class': 'btn next-page pull-right'}).text('Next Page'));
        }
    }
}